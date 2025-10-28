// --- KONFIGURASI ---
// 1. Ganti dengan URL Publikasi Google Sheet "Entire Document" Anda
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4Pk7_BlX09grO4zbc65vB5tMnaSe494NRK_jsPtMn59VkY1L8-tt8jHBU35LYj_wvpYoRkkWLuq2N/pub?output=csv";

// 2. Ganti GID ini sesuai GID di URL tab Google Sheet Anda
const GID_PRODUK = "120893533";
const GID_REGULER = "1892662557";
const GID_STRATA = "751464644";
const GID_TAMBAHAN = "1250874927";
const GID_COD = "1208747833";
const GID_LOYALTI = "51013430";

// --- Variabel Global Database ---
let dbProduk = new Map();
let dbReguler = [];
let dbStrata = []; // Diurutkan Ascending (QTY kecil ke besar)
let dbTambahan = [];
let promoTambahanMap = new Map();
let dbCOD = [];
let dbLoyalti = [];
let keranjang = new Map();

// --- Elemen DOM ---
const loadingEl = document.getElementById('loading');
const containerEl = document.querySelector('.kalkulator-container');
const menuContainerEl = document.getElementById('menuContainer');
const keranjangEl = document.getElementById('daftarKeranjang');
const kelasPelangganEl = document.getElementById('kelasPelanggan');
const inputVoucherEl = document.getElementById('inputVoucher');
const upsellRegulerEl = document.getElementById('daftarUpsellReguler');
const btnResetEl = document.getElementById('btn-reset');
// Panel Slide-Up
const summaryPanelEl = document.querySelector('.simulasi-order');
const toggleSummaryBtn = document.getElementById('toggle-summary-btn');
const closeSummaryBtn = document.getElementById('close-summary-btn');
// Modal
const modalEl = document.getElementById('modalStrata');
const modalTitleEl = document.getElementById('modalTitle');
const modalContentEl = document.getElementById('infoStrataContent');
const closeModalBtn = document.querySelector('.close-modal');

// --- Elemen DOM Output ---
const subtotalBrutoEl = document.getElementById('subtotalBruto');
const diskonRegulerEl = document.getElementById('diskonReguler');
const diskonStrataEl = document.getElementById('diskonStrata');
const diskonTambahanEl = document.getElementById('diskonTambahan');
const totalFakturEl = document.getElementById('totalFaktur');
const diskonCODEl = document.getElementById('diskonCOD');
const potonganVoucherEl = document.getElementById('potonganVoucher');
const totalNettOnFakturEl = document.getElementById('totalNettOnFaktur');
const diskonLoyaltiEl = document.getElementById('diskonLoyalti');
const hargaNettAkhirEl = document.getElementById('hargaNettAkhir');


// --- Fungsi Helper ---
function formatRupiah(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka); }
function formatAngka(angka) { return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(angka); }
async function fetchSheetData(gid) { const url = `${GOOGLE_SHEET_URL}&gid=${gid}&single=true&output=csv`; return new Promise((resolve, reject) => { Papa.parse(url, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true, complete: (results) => { console.log(`Data GID ${gid} berhasil dimuat.`); resolve(results.data); }, error: (err) => { console.error(`Gagal memuat GID ${gid}:`, err); reject(err); } }); }); }
function cleanStrataData(data) { const strataGroups = Object.keys(data[0]).filter(k => k.toUpperCase() !== 'QTY'); return data.map(row => { if (typeof row.QTY === 'string') { row.QTY = parseInt(row.QTY.replace(/[^0-9]/g, '')) || 0; } for (const group of strataGroups) { let val = row[group]; if (typeof val === 'string') { row[group] = parseInt(val.replace(/[^0-9]/g, '')) || 0; } else if (val === null || val === undefined) { row[group] = 0; } } return row; }).sort((a, b) => a.QTY - b.QTY); }
function cleanTierData(data, key) { return data.map(row => ({ ...row })).sort((a, b) => b[key] - a[key]); }
function toggleSummaryPanel() { summaryPanelEl.classList.toggle('summary-visible'); const isVisible = summaryPanelEl.classList.contains('summary-visible'); toggleSummaryBtn.textContent = isVisible ? '🛒 Sembunyikan Ringkasan' : '🛒 Lihat Ringkasan'; document.body.style.overflow = isVisible ? 'hidden' : 'auto'; }


// --- Fungsi Inisialisasi ---
async function init() {
    try {
        const [
            produkData, regData, strataData, tamData, codData, loyData
        ] = await Promise.all([
            fetchSheetData(GID_PRODUK),
            fetchSheetData(GID_REGULER),
            fetchSheetData(GID_STRATA),
            fetchSheetData(GID_TAMBAHAN),
            fetchSheetData(GID_COD),
            fetchSheetData(GID_LOYALTI)
        ]);

        // 1. Proses Produk
        dbProduk.clear(); // Pastikan map kosong sebelum diisi
        produkData.forEach(p => {
            const hargaKarton = p['HARGA (INC PPN)'];
            const boxPerKrt = p.BOX_PER_CRT || 1;
            const pcsPerBox = p.PCS_PER_BOX || 1;

            p.HargaKarton = hargaKarton;
            p.HargaBox = hargaKarton / boxPerKrt;
            p.HargaPcs = p.HargaBox / pcsPerBox;

            // --- PERUBAHAN DI SINI ---
            // Pastikan KD_SKU_PARENT ada dan konversi ke string untuk kunci Map
            if (p.KD_SKU_PARENT !== null && p.KD_SKU_PARENT !== undefined) {
                const skuString = String(p.KD_SKU_PARENT); // Konversi ke string
                dbProduk.set(skuString, p); // Gunakan string sebagai kunci
            } else {
                console.warn("Ditemukan produk tanpa KD_SKU_PARENT:", p);
            }
            // --- AKHIR PERUBAHAN ---
        });
        console.log(`dbProduk Map dibuat dengan ${dbProduk.size} entri.`); // Debug

        // 2. Proses Aturan Diskon (Sama)
        dbReguler = cleanTierData(regData, 'NOMINAL FAKTUR');
        dbCOD = cleanTierData(codData, 'NOMINAL FAKTUR');
        dbTambahan = tamData;
        promoTambahanMap.clear();
        dbTambahan.forEach(promo => { if (promo.GROUP) { promoTambahanMap.set(promo.GROUP, promo); } });
        dbLoyalti = loyData;
        dbStrata = cleanStrataData(strataData); // Ascending QTY

        // 3. Bangun Tampilan (Sama)
        buildMenu();
        buildDropdowns();

        // 4. Tampilkan aplikasi (Sama)
        loadingEl.style.display = 'none';
        containerEl.style.display = 'flex'; // Default desktop

        // 5. Tambah Listener (Sama)
        kelasPelangganEl.addEventListener('change', renderSimulasi);
        inputVoucherEl.addEventListener('input', renderSimulasi);
        closeModalBtn.addEventListener('click', () => modalEl.style.display = 'none');
        window.addEventListener('click', (event) => { if (event.target == modalEl) { modalEl.style.display = 'none'; } });
        btnResetEl.addEventListener('click', resetAplikasi);
        toggleSummaryBtn.addEventListener('click', toggleSummaryPanel);
        closeSummaryBtn.addEventListener('click', toggleSummaryPanel);

    } catch (error) {
        loadingEl.innerText = `Gagal memuat data. Periksa GID atau URL Google Sheet. Error: ${error.message}`;
        console.error("Kesalahan Inisialisasi:", error);
    }
}

// --- Fungsi Membangun Tampilan (Menu) ---
// --- Fungsi Membangun Tampilan (Menu) ---
// UPDATED: Menambahkan console.log untuk debugging event listener
function buildMenu() {
    const groupedProduk = {}; dbProduk.forEach(p => { const group = p.ECERAN || 'LAIN-LAIN'; if (!groupedProduk[group]) groupedProduk[group] = []; groupedProduk[group].push(p); });
    menuContainerEl.innerHTML = ''; const sortedGroupNames = Object.keys(groupedProduk).sort();

    console.log("Membangun menu..."); // Debug: Pastikan fungsi ini berjalan

    for (const groupName of sortedGroupNames) {
        const items = groupedProduk[groupName];
        let itemHTML = '';
        items.forEach(p => {
            itemHTML += `<div class="kartu-produk" data-sku="${p.KD_SKU_PARENT}"><div><div class="nama-item">${p.NAMA_SKU_PARENT}</div><div class="harga-item">${formatRupiah(p.HargaKarton)}/Krt | ${p.BOX_PER_CRT} Box/Krt | ${p.PCS_PER_BOX} Pcs/Box</div></div><div class="input-qty"><input type="number" min="0" placeholder="Krt" class="input-krt" data-sku="${p.KD_SKU_PARENT}"><input type="number" min="0" placeholder="Box" class="input-box" data-sku="${p.KD_SKU_PARENT}"></div></div>`;
        });
        const promoInfo = promoTambahanMap.get(groupName); let promoTambahanBtnHTML = ''; if (promoInfo) promoTambahanBtnHTML = `<button class="promo-tambahan-btn" data-group="${groupName}">🎁 Info Promo Tambahan</button>`; let strataInfoBtnHTML = ''; const hasStrataPromo = dbStrata.length > 0 && dbStrata[0].hasOwnProperty(groupName) && dbStrata.some(tier => tier[groupName] > 0); if (hasStrataPromo) strataInfoBtnHTML = `<button class="strata-info-btn" data-stratagroup="${groupName}">Info Strata (${groupName})</button>`; const groupHTML = `<div class="grup-produk"><div class="grup-header"><h3>Grup Strata: ${groupName}</h3><div class="grup-header-tombol">${promoTambahanBtnHTML}${strataInfoBtnHTML}</div></div>${itemHTML}</div>`;
        menuContainerEl.innerHTML += groupHTML;
    }

    // --- PEMERIKSAAN EVENT LISTENER ---
    const inputFields = menuContainerEl.querySelectorAll('.input-krt, .input-box');
    console.log(`Menemukan ${inputFields.length} input field.`); // Debug: Berapa banyak input yang ditemukan?

    inputFields.forEach((input, index) => {
        input.addEventListener('change', (event) => { // Pastikan event 'change'
            console.log(`Input #${index} (${event.target.className}) berubah! Memanggil updateKeranjang...`); // Debug: Apakah event terpicu?
            updateKeranjang(event);
        });
        // console.log(`Listener 'change' ditambahkan ke input #${index}`); // Debug (Opsional, bisa jadi terlalu banyak log)
    });

    menuContainerEl.querySelectorAll('.strata-info-btn').forEach(btn => {
        btn.addEventListener('click', showStrataInfo);
    });
    menuContainerEl.querySelectorAll('.promo-tambahan-btn').forEach(btn => {
        btn.addEventListener('click', showPromoTambahanInfo);
    });
    console.log("Semua listener menu selesai ditambahkan."); // Debug: Konfirmasi akhir
}
function buildDropdowns() { kelasPelangganEl.innerHTML = '<option value="">- Pilih Kelas -</option>'; dbLoyalti.forEach(item => { kelasPelangganEl.innerHTML += `<option value="${item.KELAS}">${item.KELAS} (${item.REWARD * 100}%)</option>`; }); }
function showStrataInfo(event) { const strataGroup = event.target.dataset.stratagroup; let infoText = `QTY Karton | Potongan/Karton\n----------------------------\n`; let lastShownPotongan = -1; if (dbStrata.length > 0 && dbStrata[0].hasOwnProperty(strataGroup)) { dbStrata.forEach(tier => { const currentPotongan = tier[strataGroup] || 0; if (currentPotongan > 0 && currentPotongan > lastShownPotongan) { infoText += `${tier.QTY} Krt      | ${formatRupiah(currentPotongan)}\n`; lastShownPotongan = currentPotongan; } }); if (lastShownPotongan < 0) infoText += "(Tidak ada potongan aktif untuk grup ini)\n"; } else { infoText = `Tidak ada aturan strata yang ditemukan untuk grup ${strataGroup}.`; } modalTitleEl.innerText = `Info Strata (${strataGroup})`; modalContentEl.innerText = infoText; modalEl.style.display = 'block'; }
function showPromoTambahanInfo(event) { const groupName = event.target.dataset.group; const promoInfo = promoTambahanMap.get(groupName); let infoText = ""; if (promoInfo) { infoText += `Deskripsi: Promo ${promoInfo.GROUP}\nMinimal Qty: ${promoInfo.QTY} Karton\nMinimal Item: ${promoInfo.ITEM} item berbeda\nPotongan: ${formatRupiah(promoInfo.POT)} / Karton\n`; } else { infoText = `Tidak ada promo tambahan untuk grup ${groupName}.`; } modalTitleEl.innerText = `Info Promo Tambahan (${groupName})`; modalContentEl.innerText = infoText; modalEl.style.display = 'block'; }
function resetAplikasi() { keranjang.clear(); menuContainerEl.querySelectorAll('.input-krt, .input-box').forEach(input => { input.value = ''; }); kelasPelangganEl.value = ''; inputVoucherEl.value = '0'; renderSimulasi(); if (summaryPanelEl.classList.contains('summary-visible')) toggleSummaryPanel(); }


// --- Fungsi Update & Render ---
function updateKeranjang(event) {
    const sku = event.target.dataset.sku;
    const isKarton = event.target.classList.contains('input-krt');
    const value = parseInt(event.target.value) || 0;
    let item = keranjang.get(sku) || { sku: sku, qtyKarton: 0, qtyBox: 0 };
    if (isKarton) item.qtyKarton = value; else item.qtyBox = value;
    if (item.qtyKarton > 0 || item.qtyBox > 0) keranjang.set(sku, item); else keranjang.delete(sku);
    renderSimulasi();
}

// --- FUNGSI KERANJANG & UPSELL STRATA (Logika Upsell Cerdas) ---
function renderKeranjang(totalKartonPerEceran) {
    if (keranjang.size === 0) { keranjangEl.innerHTML = '<p>(Keranjang kosong)</p>'; return; }
    keranjangEl.innerHTML = '';
    for (const eceran in totalKartonPerEceran) {
        const qtyGrup = totalKartonPerEceran[eceran];
        let grupHTML = `<div class="keranjang-grup-header">${eceran} (Total ${formatAngka(qtyGrup)} Krt)</div>`;
        let itemListHTML = '<ul class="keranjang-item-list">';
        keranjang.forEach(item => { const produk = dbProduk.get(item.sku); if (produk && produk.ECERAN === eceran) { const totalBrutoItem = (item.qtyKarton * produk.HargaKarton) + (item.qtyBox * produk.HargaBox); itemListHTML += `<li><span><strong>${produk.NAMA_SKU_PARENT}</strong><br>(${item.qtyKarton} Krt, ${item.qtyBox} Box)</span><span>${formatRupiah(totalBrutoItem)}</span></li>`; } });
        itemListHTML += '</ul>';
        let currentPotongan = 0;
        const currentTier = [...dbStrata].reverse().find(tier => qtyGrup >= tier.QTY && tier[eceran] > 0);
        if (currentTier) currentPotongan = currentTier[eceran];
        const nextUpsellTier = dbStrata.find(tier => tier.QTY > qtyGrup && tier[eceran] > currentPotongan);
        let upsellStrataHTML = '';
        if (nextUpsellTier) { const qtyDibutuhkan = nextUpsellTier.QTY - qtyGrup; upsellStrataHTML = `<div class="keranjang-upsell-strata">📈 Tambah <strong>${formatAngka(qtyDibutuhkan)} Krt</strong> lagi (total ${nextUpsellTier.QTY} Krt) untuk dapat potongan ${formatRupiah(nextUpsellTier[eceran])}/Krt.</div>`; } else { upsellStrataHTML = `<div class="keranjang-upsell-strata tertinggi">🏆 Anda sudah di tier Strata tertinggi.</div>`; }
        keranjangEl.innerHTML += grupHTML + itemListHTML + upsellStrataHTML;
    }
}

// --- FUNGSI UPSELL REGULER ---
function renderUpsellReguler(totalBrutoPerGrup) {
    let recommendations = [];
    for (const grup in totalBrutoPerGrup) {
        const brutoGrup = totalBrutoPerGrup[grup];
        let currentTierIndex = -1;
        for (let i = 0; i < dbReguler.length; i++) { if (brutoGrup >= dbReguler[i]['NOMINAL FAKTUR']) { currentTierIndex = i; break; } }
        let nextTier = null;
        if (currentTierIndex === -1 && dbReguler.length > 0) nextTier = dbReguler[dbReguler.length - 1]; else if (currentTierIndex > 0) nextTier = dbReguler[currentTierIndex - 1];
        if (nextTier && nextTier[grup] > 0) { const rpDibutuhkan = nextTier['NOMINAL FAKTUR'] - brutoGrup; if (rpDibutuhkan > 0) { const diskonBaru = nextTier[grup] * 100; recommendations.push(`<li><strong>${grup}:</strong> Tambah <strong>${formatRupiah(rpDibutuhkan)}</strong> lagi (total ${formatRupiah(nextTier['NOMINAL FAKTUR'])}) untuk dapat diskon ${diskonBaru}%.</li>`); } } else if (currentTierIndex === 0) recommendations.push(`<li><strong>${grup}:</strong> 🏆 Anda sudah di tier Reguler tertinggi.</li>`);
    }
    if (recommendations.length > 0) upsellRegulerEl.innerHTML = recommendations.join(''); else upsellRegulerEl.innerHTML = '<li>(Tambahkan item untuk melihat rekomendasi)</li>';
}


// ==========================================================
// FUNGSI LOGIKA INTI
// ==========================================================
function renderSimulasi() {
    console.log("--- Memulai renderSimulasi ---");

    // 1. Hitung Total Bruto & Agregasi
    let subtotalBruto = 0; let totalNilaiLoyalti = 0; let totalBrutoPerGrup = {}; let totalKartonPerEceran = {}; let distinctItemsPerEceran = {};
    console.log("Keranjang saat ini:", keranjang);

    keranjang.forEach((item, skuKey) => { // Gunakan skuKey dari Map iterator

        // --- PERUBAHAN DI SINI ---
        const skuString = String(skuKey); // Pastikan kita mencari dengan string
        const produk = dbProduk.get(skuString); // Mencari dengan string
        // --- AKHIR PERUBAHAN ---

        if (!produk) {
            // Seharusnya ini tidak terjadi lagi, tapi jaga-jaga
            console.error(`Produk tidak ditemukan untuk SKU: ${skuString} (tipe: ${typeof skuString})`);
            return;
        }

        console.log(`Item: ${produk.NAMA_SKU_PARENT}, Krt: ${item.qtyKarton}, Box: ${item.qtyBox}, HargaKarton: ${produk.HargaKarton}, HargaBox: ${produk.HargaBox}, BOX_PER_CRT: ${produk.BOX_PER_CRT}`);

        // Kalkulasi (sama seperti sebelumnya, pastikan validasi NaN ada)
        const qtyKartonValid = !isNaN(item.qtyKarton) ? item.qtyKarton : 0;
        const qtyBoxValid = !isNaN(item.qtyBox) ? item.qtyBox : 0;
        const hargaKartonValid = !isNaN(produk.HargaKarton) ? produk.HargaKarton : 0;
        const hargaBoxValid = !isNaN(produk.HargaBox) ? produk.HargaBox : 0;
        const boxPerCrtValid = (produk.BOX_PER_CRT && !isNaN(produk.BOX_PER_CRT) && produk.BOX_PER_CRT !== 0) ? produk.BOX_PER_CRT : 1;

        const totalBrutoItem = (qtyKartonValid * hargaKartonValid) + (qtyBoxValid * hargaBoxValid);
        const totalKartonItem = qtyKartonValid + (qtyBoxValid / boxPerCrtValid);

        console.log(` -> TotalBrutoItem: ${totalBrutoItem}, TotalKartonItem: ${totalKartonItem}`);

        if (isNaN(totalBrutoItem) || isNaN(totalKartonItem)) {
             console.error(`Kesalahan kalkulasi untuk item ${produk.NAMA_SKU_PARENT}. Periksa harga/qty.`);
             return;
        }

        const grupReguler = produk.GROUP;
        const grupEceran = produk.ECERAN;

        if (!grupReguler || !grupEceran) {
             console.error(`Item ${produk.NAMA_SKU_PARENT} (SKU: ${skuString}) tidak memiliki kolom GROUP atau ECERAN.`);
             return;
        }

        subtotalBruto += totalBrutoItem;
        totalBrutoPerGrup[grupReguler] = (totalBrutoPerGrup[grupReguler] || 0) + totalBrutoItem;
        totalKartonPerEceran[grupEceran] = (totalKartonPerEceran[grupEceran] || 0) + totalKartonItem;

        if (!distinctItemsPerEceran[grupEceran]) distinctItemsPerEceran[grupEceran] = new Set();
        distinctItemsPerEceran[grupEceran].add(skuString); // Gunakan string

        if (produk.ITEM_LOYALTI === 'Y') totalNilaiLoyalti += totalBrutoItem;
    });

    console.log("Subtotal Bruto:", subtotalBruto);
    console.log("Total Karton per Eceran:", totalKartonPerEceran);
    console.log("Total Bruto per Grup Reguler:", totalBrutoPerGrup);
    console.log("Distinct Items per Eceran:", distinctItemsPerEceran);

    subtotalBrutoEl.innerText = formatRupiah(subtotalBruto);
    console.log("Subtotal Bruto diupdate di HTML.");

    // 2. Panggil fungsi render keranjang & upsell (Sama)
    renderKeranjang(totalKartonPerEceran);
    renderUpsellReguler(totalBrutoPerGrup);
    console.log("Keranjang & Upsell dirender.");

    // 3. Hitung Diskon #1: Reguler (Sama)
    let totalDiskonReguler = 0; console.log("Menghitung Diskon Reguler..."); for (const grup in totalBrutoPerGrup) { const brutoGrup = totalBrutoPerGrup[grup]; if (dbReguler.length > 0 && !(grup in dbReguler[0])) { console.warn(`Kolom grup '${grup}' tidak ditemukan di dbReguler.`); continue; } const tier = dbReguler.find(t => brutoGrup >= t['NOMINAL FAKTUR']); if (tier && tier[grup]) { console.log(` -> Grup ${grup}: Bruto=${brutoGrup}, Tier=${tier['NOMINAL FAKTUR']}, Diskon=${tier[grup]}`); totalDiskonReguler += brutoGrup * tier[grup]; } else { console.log(` -> Grup ${grup}: Bruto=${brutoGrup}, Tidak ada tier ditemukan.`); } } diskonRegulerEl.innerText = `- ${formatRupiah(totalDiskonReguler)}`; console.log("Diskon Reguler:", totalDiskonReguler);

    // 4. Hitung Diskon #2: Strata (Sama)
    let totalPotonganStrata = 0; console.log("Menghitung Potongan Strata..."); for (const eceran in totalKartonPerEceran) { const qtyGrup = totalKartonPerEceran[eceran]; if (dbStrata.length > 0 && !(eceran in dbStrata[0])) { console.warn(`Kolom eceran '${eceran}' tidak ditemukan di dbStrata.`); continue; } const currentTier = [...dbStrata].reverse().find(tier => qtyGrup >= tier.QTY && tier[eceran] > 0); if (currentTier) { console.log(` -> Eceran ${eceran}: Qty=${qtyGrup}, Tier Qty=${currentTier.QTY}, Potongan=${currentTier[eceran]}`); totalPotonganStrata += qtyGrup * currentTier[eceran]; } else { console.log(` -> Eceran ${eceran}: Qty=${qtyGrup}, Tidak ada tier ditemukan.`); } } diskonStrataEl.innerText = `- ${formatRupiah(totalPotonganStrata)}`; console.log("Potongan Strata:", totalPotonganStrata);

    // 5. Hitung Diskon #3: Tambahan (Sama)
    let totalPotonganTambahan = 0; console.log("Menghitung Potongan Tambahan..."); dbTambahan.forEach(promo => { const grupPromo = promo.GROUP; const qtyMin = promo.QTY; const itemMin = promo.ITEM; const potongan = promo.POT; const qtyGroupActual = totalKartonPerEceran[grupPromo] || 0; const distinctItemsInGroup = distinctItemsPerEceran[grupPromo]?.size || 0; console.log(` -> Cek Promo Tambahan ${grupPromo}: Qty Aktual=${qtyGroupActual} (Min=${qtyMin}), Item Aktual=${distinctItemsInGroup} (Min=${itemMin})`); if (qtyGroupActual >= qtyMin && distinctItemsInGroup >= itemMin) { console.log(`   -> SYARAT TERPENUHI! Potongan ${potongan} x ${qtyGroupActual}`); totalPotonganTambahan += qtyGroupActual * potongan; } }); diskonTambahanEl.innerText = `- ${formatRupiah(totalPotonganTambahan)}`; console.log("Potongan Tambahan:", totalPotonganTambahan);

    // 6. Hitung Total Faktur (Sama)
    const totalFaktur = subtotalBruto - totalDiskonReguler - totalPotonganStrata - totalPotonganTambahan; totalFakturEl.innerText = formatRupiah(totalFaktur); console.log("Total Faktur:", totalFaktur);

    // 7. Hitung Diskon #4: COD (Sama)
    let totalDiskonCOD = 0; const metodeBayar = 'COD'; console.log("Menghitung Diskon COD..."); if (metodeBayar === 'COD') { const tier = dbCOD.find(t => totalFaktur >= t['NOMINAL FAKTUR']); if (tier) { console.log(` -> Tier COD ditemukan: ${tier.COD}`); totalDiskonCOD = totalFaktur * tier.COD; } else { console.log(` -> Tidak ada tier COD ditemukan.`); } } diskonCODEl.innerText = `- ${formatRupiah(totalDiskonCOD)}`; console.log("Diskon COD:", totalDiskonCOD);

    // 8. Hitung Diskon #5: Voucher (Sama)
    const nilaiVoucherInput = parseFloat(inputVoucherEl.value) || 0; let nilaiVoucherTerpakai = nilaiVoucherInput; console.log("Menghitung Voucher..."); console.log(` -> Nilai Voucher Input: ${nilaiVoucherInput}, Total Nilai Loyalti: ${totalNilaiLoyalti}`); if (nilaiVoucherInput > totalNilaiLoyalti) { nilaiVoucherTerpakai = totalNilaiLoyalti; console.log(`   -> Voucher dibatasi menjadi ${nilaiVoucherTerpakai}`); } potonganVoucherEl.innerText = `- ${formatRupiah(nilaiVoucherTerpakai)}`; console.log("Potongan Voucher:", nilaiVoucherTerpakai);

    // 9. Hitung Harga Nett (On Faktur) (Sama)
    const hargaNettOnFaktur = totalFaktur - totalDiskonCOD - nilaiVoucherTerpakai; totalNettOnFakturEl.innerText = formatRupiah(hargaNettOnFaktur); console.log("Harga Nett On Faktur:", hargaNettOnFaktur);

    // 10. Simulasi Diskon #6: Loyalti (Sama)
    let totalDiskonLoyalti = 0; const kelasLoyalti = kelasPelangganEl.value; console.log("Menghitung Diskon Loyalti..."); console.log(` -> Kelas terpilih: ${kelasLoyalti}`); const tierLoyalti = dbLoyalti.find(t => t.KELAS === kelasLoyalti); if (tierLoyalti) { console.log(` -> Tier Loyalti ditemukan: ${tierLoyalti.REWARD}`); totalDiskonLoyalti = hargaNettOnFaktur * tierLoyalti.REWARD; } else { console.log(` -> Tier Loyalti tidak ditemukan/tidak dipilih.`); } diskonLoyaltiEl.innerText = `(${formatRupiah(totalDiskonLoyalti)})`; console.log("Diskon Loyalti:", totalDiskonLoyalti);

    // 11. Hitung Harga Nett Akhir (Simulasi) (Sama)
    const hargaNettAkhir = hargaNettOnFaktur - totalDiskonLoyalti; hargaNettAkhirEl.innerText = formatRupiah(hargaNettAkhir); console.log("Harga Nett Akhir:", hargaNettAkhir);
    console.log("--- renderSimulasi Selesai ---");
}

// --- Mulai aplikasi ---
document.addEventListener('DOMContentLoaded', init);



