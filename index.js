const upload = document.getElementById('upload');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('download');

const numColumnsInput = document.getElementById('numColumns');
const fontSizeInput = document.getElementById('fontSize');
const fontColorInput = document.getElementById('fontColor');
const fontFamilyInput = document.getElementById('fontFamily');
const vSpacingInput = document.getElementById('vSpacing');
const hSpacingInput = document.getElementById('hSpacing');
const bgColorInput = document.getElementById('bgColor');
const fontStyleInput = document.getElementById('fontStyle');

let pantoneColors;
let uploadedImg = null;

function rgbToLab([r, g, b]) {
  [r, g, b] = [r, g, b].map(v => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  });
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
  return [
    116 * f(y) - 16,
    500 * (f(x) - f(y)),
    200 * (f(y) - f(z))
  ];
}

fetch('pantone_colors_rgb.json')
  .then(res => res.json())
  .then(data => {
    pantoneColors = Object.entries(data).map(([name, rgb]) => {
      const lab = rgbToLab(rgb);
      return { name, rgb, lab };
    });
  });

upload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !pantoneColors) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  uploadedImg = img;
  console.log(uploadedImg);

  // Automatically set default variables based on image size
  const aspectRatio = img.width / img.height;
  numColumnsInput.value = 2;
  console.log(numColumnsInput.value);
  fontSizeInput.value = Math.max(10, Math.min(30, Math.round(img.width / 100))); // Adjust font size
  vSpacingInput.value = Math.max(5, Math.min(15, Math.round(img.height / 200))); // Adjust vertical spacing
  hSpacingInput.value = Math.max(5, Math.min(15, Math.round(img.width / 200))); // Adjust horizontal spacing

  renderImage();
});

async function renderImage() {
  if (!uploadedImg || !pantoneColors) return;
  console.log('Rendering image...');

  const img = uploadedImg;
  const numColumns = parseInt(numColumnsInput.value);
  const fontSize = parseInt(fontSizeInput.value);
  const fontColor = fontColorInput.value;
  const fontFamily = fontFamilyInput.value;
  const vSpacing = parseInt(vSpacingInput.value);
  const hSpacing = parseInt(hSpacingInput.value);
  const labelHeight = fontSize * 1.25;
  const bgColor = bgColorInput.value;

  const aspect = img.width / img.height;
  const blockSize = Math.floor((img.width - (numColumns - 1) * hSpacing) / numColumns);
  const swatchW = blockSize + hSpacing;
  const swatchH = blockSize + labelHeight + vSpacing;
  const numRows = Math.round(numColumns / aspect * (swatchW / swatchH));

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = numColumns;
  tempCanvas.height = numRows;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0, numColumns, numRows);
  const imgData = tempCtx.getImageData(0, 0, numColumns, numRows).data;

  const outW = numColumns * swatchW - hSpacing;
  const outH = numRows * swatchH - vSpacing;

  const pixelRatio = window.devicePixelRatio || 2;
  canvas.width = (outW + 50) * pixelRatio;
  canvas.height = (outH + 50) * pixelRatio;
  
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const fontStyle = fontStyleInput.value;
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.fillStyle = fontColor;

  for (let y = 0; y < numRows; y++) {
    for (let x = 0; x < numColumns; x++) {
      const idx = (y * numColumns + x) * 4;
      const rgb = [imgData[idx], imgData[idx + 1], imgData[idx + 2]];

      const lab = rgbToLab(rgb);
      let closest = pantoneColors[0];
      let minDist = Infinity;
      for (const pantone of pantoneColors) {
        const d = Math.hypot(
          lab[0] - pantone.lab[0],
          lab[1] - pantone.lab[1],
          lab[2] - pantone.lab[2]
        );
        if (d < minDist) {
          minDist = d;
          closest = pantone;
        }
      }

      const x0 = x * swatchW + 25;
      const y0 = y * swatchH + 25;
      ctx.fillStyle = `rgb(${closest.rgb.join(",")})`;
      ctx.fillRect(x0, y0, blockSize, blockSize);

      const name = closest.name.slice(0, 20);
      ctx.fillStyle = fontColor;
      ctx.fillText(name, x0 + blockSize / 2, y0 + blockSize + labelHeight);
    }
  }

  downloadBtn.disabled = false;
}

[numColumnsInput, fontSizeInput, fontColorInput, fontFamilyInput, fontStyleInput, vSpacingInput, hSpacingInput, bgColorInput].forEach(input => {
  input.addEventListener('input', () => {
    if (uploadedImg) renderImage();
  });
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'pantone_output.png';
  link.href = canvas.toDataURL();
  link.click();
});