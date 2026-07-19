const { spawn } = require('child_process');
const path = require('path');

function runPythonOcr(filePath, context = {}) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, '../scripts/analyze-transfer-proof.py');
    const child = spawn(process.env.PYTHON_BIN || 'python3', [
      script,
      filePath,
      context.no_rekening_tujuan || '',
      context.nama_warga || '',
      context.no_rumah || ''
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(stderr.trim() || 'OCR lokal gagal dijalankan'));
      try { resolve(JSON.parse(stdout)); } catch(e) { reject(new Error('Output OCR lokal tidak valid')); }
    });
  });
}

async function analisaBuktiTransfer(filePath, mimeType, context = {}) {
  const result = await runPythonOcr(filePath, context);
  return {
    status_analisa: result.status_analisa || 'berhasil',
    status_transaksi: String(result.status_transaksi || '').trim(),
    bank_pengirim: String(result.bank_pengirim || '').trim(),
    validasi_bank_pengirim: typeof result.validasi_bank_pengirim === 'boolean' ? result.validasi_bank_pengirim : null,
    no_rekening_tujuan: String(result.no_rekening_tujuan || '').trim(),
    nominal_transfer: Number(result.nominal_transfer || 0),
    tanggal_transfer: String(result.tanggal_transfer || '').trim(),
    catatan_transfer: String(result.catatan_transfer || '').trim(),
    catatan: String(result.catatan || '').trim(),
    raw_text: String(result.raw_text || '').trim(),
    confidence: Number(result.confidence || 0)
  };
}

module.exports = { analisaBuktiTransfer };
