const express = require('express');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(express.json());

app.post('/verify', async (req, res) => {
  const { key, deviceId } = req.body;
  if (!key || !deviceId) return res.status(400).json({ status: false, message: 'Missing data' });
  
  try {
    const snap = await db.collection('keys').where('key', '==', key).limit(1).get();
    if (snap.empty) return res.json({ status: false, message: 'Invalid key' });
    
    const doc = snap.docs[0];
    const data = doc.data();
    const now = admin.firestore.Timestamp.now();
    let expiryDate;
    
    if (data.status === 'unused') {
      expiryDate = new admin.firestore.Timestamp(now.seconds + ((data.duration || 30) * 86400), 0);
      await doc.ref.update({ status: 'active', hwid: deviceId, expiry_date: expiryDate, activated_at: now });
    } else if (data.status === 'active') {
      if (data.hwid !== deviceId) return res.json({ status: false, message: 'Wrong device' });
      expiryDate = data.expiry_date;
      if (now.seconds > expiryDate.seconds) return res.json({ status: false, message: 'Expired' });
    } else {
      return res.json({ status: false, message: 'Not active' });
    }
    
    res.json({ status: true, expiry: expiryDate.toDate().toISOString() });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('🚀 Server is Running'));
