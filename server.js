require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-moi';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const MONGODB_URI = process.env.MONGODB_URI;

// Chemin secret pour accéder à l'espace admin, ex: "x7k-panel-2p9".
// Défini via la variable d'environnement ADMIN_PATH. Change bien la valeur par défaut.
const ADMIN_PATH = '/' + (process.env.ADMIN_PATH || 'admin').replace(/^\/+|\/+$/g, '');

if (!MONGODB_URI) {
  console.error('MONGODB_URI manquant dans les variables d\'environnement. Le serveur ne peut pas démarrer.');
  process.exit(1);
}

let db, videosCollection, bucket;

async function initMongo() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(); // utilise la base indiquée dans l'URI
  videosCollection = db.collection('videos');
  bucket = new GridFSBucket(db, { bucketName: 'videoFiles' });
  console.log('Connecté à MongoDB');
}

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  return res.redirect(`${ADMIN_PATH}/login.html`);
}

// --- Upload vidéos (multer, en mémoire puis transféré vers GridFS) ---
const ALLOWED_MIME = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 Go max, à ajuster
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non autorisé. Formats acceptés : mp4, webm, ogg, mov.'));
    }
  },
});

// --- Fichiers statiques ---
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
// Assets admin (CSS/JS) servis sur un chemin fixe : ce ne sont que des fichiers de présentation,
// la partie sensible (page de connexion, tableau de bord) reste sur le chemin secret ADMIN_PATH.
app.use('/admin-assets/css', express.static(path.join(__dirname, 'admin', 'css')));
app.use('/admin-assets/js', express.static(path.join(__dirname, 'admin', 'js')));

// --- Pages publiques ---
app.get('/', (req, res) => {
  const html = fs
    .readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8')
    .replace('__ADMIN_LOGIN_URL__', `${ADMIN_PATH}/login.html`);
  res.send(html);
});

// --- API publique : liste des vidéos ---
app.get('/api/videos', async (req, res) => {
  const videos = await videosCollection.find().sort({ createdAt: -1 }).toArray();
  res.json(
    videos.map((v) => ({
      id: v._id,
      title: v.title,
      description: v.description,
      fileId: v.fileId,
      createdAt: v.createdAt,
    }))
  );
});

// --- Diffusion des vidéos depuis GridFS (avec support des requêtes "Range" pour la lecture/scrub) ---
app.get('/media/:fileId', async (req, res) => {
  let fileObjectId;
  try {
    fileObjectId = new ObjectId(req.params.fileId);
  } catch (e) {
    return res.status(400).send('Identifiant invalide');
  }

  const files = await db.collection('videoFiles.files').findOne({ _id: fileObjectId });
  if (!files) return res.status(404).send('Fichier introuvable');

  const range = req.headers.range;
  const fileSize = files.length;
  const contentType = files.contentType || 'video/mp4';

  if (!range) {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    bucket.openDownloadStream(fileObjectId).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunkSize = end - start + 1;

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': contentType,
  });

  bucket.openDownloadStream(fileObjectId, { start, end: end + 1 }).pipe(res);
});

// --- Auth admin ---
app.get(`${ADMIN_PATH}/login.html`, (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect(`${ADMIN_PATH}/`);
  }
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.post(`${ADMIN_PATH}/login`, (req, res) => {
  const { password } = req.body;
  if (password && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Mot de passe incorrect' });
});

app.post(`${ADMIN_PATH}/logout`, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// --- Espace admin protégé ---
app.get(`${ADMIN_PATH}/`, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

app.get(ADMIN_PATH, (req, res) => res.redirect(`${ADMIN_PATH}/`));

// --- API admin : liste complète (pour dashboard) ---
app.get('/api/admin/videos', requireAdmin, async (req, res) => {
  const videos = await videosCollection.find().sort({ createdAt: -1 }).toArray();
  res.json(videos.map((v) => ({ id: v._id, title: v.title, description: v.description, fileId: v.fileId, createdAt: v.createdAt })));
});

// --- API admin : upload d'une nouvelle vidéo ---
app.post('/api/admin/videos', requireAdmin, (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu' });
    }
    const { title, description } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Le titre est obligatoire' });
    }

    try {
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      uploadStream.end(req.file.buffer);

      uploadStream.on('finish', async () => {
        const doc = {
          title: title.trim(),
          description: (description || '').trim(),
          fileId: uploadStream.id,
          createdAt: Date.now(),
        };
        const result = await videosCollection.insertOne(doc);
        res.status(201).json({ id: result.insertedId, ...doc });
      });

      uploadStream.on('error', (uploadErr) => {
        res.status(500).json({ error: 'Erreur lors de l\'envoi vers MongoDB : ' + uploadErr.message });
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// --- API admin : suppression d'une vidéo ---
app.delete('/api/admin/videos/:id', requireAdmin, async (req, res) => {
  let docId;
  try {
    docId = new ObjectId(req.params.id);
  } catch (e) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  const video = await videosCollection.findOne({ _id: docId });
  if (!video) return res.status(404).json({ error: 'Vidéo introuvable' });

  try {
    await bucket.delete(new ObjectId(video.fileId));
  } catch (e) {
    // Le fichier binaire est peut-être déjà absent, on continue quand même la suppression des métadonnées
    console.warn('Suppression GridFS échouée :', e.message);
  }

  await videosCollection.deleteOne({ _id: docId });
  res.json({ ok: true });
});

initMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
      console.log(`Espace admin : http://localhost:${PORT}${ADMIN_PATH}/login.html`);
    });
  })
  .catch((e) => {
    console.error('Impossible de se connecter à MongoDB :', e.message);
    process.exit(1);
  });
