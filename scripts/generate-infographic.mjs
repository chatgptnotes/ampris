import fs from 'fs';

const API_KEY = 'AIzaSyCvzk9cRbHPYdV7qVwNFqSWytAs4AV4Jgc';
const MODEL = 'gemini-2.0-flash-exp-image-generation';
const OUT_DIR = 'apps/web/public/images';

const prompt = `Create a professional, visually stunning infographic poster for GridVision SCADA — a digital twin platform for 33/11kV electrical distribution substations.

The infographic should show:
1. A schematic digital twin representation of a 33/11kV substation with:
   - 33kV incoming power line at the top
   - Two horizontal bus bars (33kV in red/maroon, 11kV in green)
   - Two power transformers (8 MVA each) connecting the bus bars
   - 6 outgoing 11kV feeders at the bottom
   - Circuit breaker symbols at key connection points

2. Overlay data panels showing real-time monitoring values:
   - Voltage: 33.1 kV / 11.0 kV
   - Total Load: 7.9 MW
   - Power Factor: 0.97
   - Transformer Oil Temp: 62C / 58C
   - System Uptime: 99.97%

3. Visual elements:
   - Glowing power flow lines/arrows showing electricity direction
   - Green status indicators for healthy equipment
   - A sleek dark navy blue (#0F172A) background
   - Blue accent glows and highlights
   - Modern glassmorphism UI cards for data overlays
   - GridVision DIGITAL TWIN label at the top

Style: Futuristic, dark-themed, professional tech product visualization. Clean typography. Suitable for a SaaS product landing page hero image. Aspect ratio approximately 4:3. No watermarks.`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

console.log('Generating infographic with Gemini AI...');
console.log('Model:', MODEL);

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  }),
});

console.log('HTTP status:', response.status);

if (!response.ok) {
  const errText = await response.text();
  console.error('API Error:', errText);
  process.exit(1);
}

const data = await response.json();
const parts = data.candidates[0].content.parts;

for (const part of parts) {
  if (part.inlineData) {
    const buf = Buffer.from(part.inlineData.data, 'base64');
    const mime = part.inlineData.mimeType;
    const ext = mime.includes('webp') ? 'webp' : mime.includes('jpeg') ? 'jpg' : 'png';
    const outPath = `${OUT_DIR}/digital-twin-infographic.${ext}`;

    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    fs.writeFileSync(outPath, buf);
    console.log(`Saved: ${outPath}`);
    console.log(`Size: ${(buf.length / 1024).toFixed(1)} KB`);
    console.log(`Type: ${mime}`);
    process.exit(0);
  }
}

console.error('No image data found in response');
process.exit(1);
