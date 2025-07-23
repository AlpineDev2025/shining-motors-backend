require('dotenv').config();
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const app = express();
app.use(cors())
const upload = multer({ dest: 'tmp', limits: { fileSize: 100 * 1024 * 1024 } });

// Set FFmpeg path for environments like Vercel
ffmpeg.setFfmpegPath(ffmpegPath);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
app.get('/', (req, res) => {
  res.send('Hello World');
});
app.post('/api/crop', upload.single('video'), async (req, res) => {
  const { cropX, cropY, cropWidth, cropHeight, userId } = req.body;
  const inputPath = req.file.path;
  const outputPath = path.join('/tmp', `cropped-${Date.now()}.mp4`);
console.log("called")
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(`crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`)
        .outputOptions('-c:a copy')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const fileBuffer = fs.readFileSync(outputPath);
    const fileName = `cropped-${uuidv4()}.mp4`;
    const filePath = `${userId}/${fileName}`;
console.log(filePath)
    const { error } = await supabase.storage
      .from('posts')
      .upload(filePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from('posts').getPublicUrl(filePath);
    res.json({ url: data.publicUrl });
    console.log(data)
  } catch (err) {
    console.error('Error cropping video:', err);
    res.status(500).json({ error: 'Video cropping failed' });
  } finally {
    fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 