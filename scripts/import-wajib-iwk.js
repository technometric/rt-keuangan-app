require('dotenv').config();
const mongoose = require('mongoose');
const WajibIwk = require('../models/WajibIwk');

const warga = require('../data/wajib-iwk-rt02.json');

function cleanArea(value) {
  const area = String(value || '').trim().toLowerCase();
  if (!['utara', 'tengah', 'selatan'].includes(area)) {
    throw new Error(`Area tidak valid: ${value}`);
  }
  return area;
}

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://192.168.1.9:27017/rt_keuangan';
  await mongoose.connect(uri);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of warga) {
    const payload = {
      nama: String(row.nama || '').trim(),
      nik: String(row.nik || '').trim(),
      hp: String(row.hp || '').trim(),
      no_rumah: String(row.no_rumah || '').trim(),
      area: cleanArea(row.area || row.blok),
      aktif: row.aktif !== false
    };

    if (!payload.nama || !payload.no_rumah) {
      skipped++;
      continue;
    }

    const existing = await WajibIwk.findOne({ no_rumah: payload.no_rumah });

    if (existing) {
      await WajibIwk.updateOne({ _id: existing._id }, { $set: payload });
      updated++;
    } else {
      await WajibIwk.create(payload);
      inserted++;
    }
  }

  console.log('Import warga RT02 selesai');
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Skipped  : ${skipped}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Import gagal:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
