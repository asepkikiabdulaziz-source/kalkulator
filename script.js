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

const CUSTOM_GROUP_ORDER = ["NEXTAR","WFR-E500","WFR-E01K","WFR-E02K","WFR-E05K","ROL-E500","ROL-E01K","AHH-E500","AHH-E01K","SIP-E500","SIP-E01K","SIP-E02K","NXT-E02K","PST-E500",,"TBK-E02K","TBK-E01K","CSD-E02K-24","CSD-E02K-12"];
                            
const PPN_RATE = 1.11;


// --- Variabel Global Database ---
let dbProduk = new Map();
let dbReguler = [];
let dbStrata = [];
let dbTambahan = [];
let promoTambahanMap = new Map();
let dbCOD = [];
let dbLoyalti = [];
let keranjang = new Map();

// --- Elemen DOM ---
const loadingEl = document.getElementById('loading'); const containerEl = document.querySelector('.kalkulator-container'); const menuContainerEl = document.getElementById('menuContainer'); const keranjangEl = document.getElementById('daftarKeranjang'); const kelasPelangganEl = document.getElementById('kelasPelanggan'); const inputVoucherEl = document.getElementById('inputVoucher'); const upsellRegulerEl = document.getElementById('daftarUpsellReguler'); const btnResetEl = document.getElementById('btn-reset'); const searchInputEl = document.getElementById('search-input'); const summaryPanelEl = document.querySelector('.simulasi-order'); const toggleSummaryBtn = document.getElementById('toggle-summary-btn'); const closeSummaryBtn = document.getElementById('close-summary-btn'); const modalEl = document.getElementById('modalDetail'); const modalTitleEl = document.getElementById('modalTitle'); const modalContentEl = document.getElementById('modalDetailContent'); const closeModalBtn = document.querySelector('.close-modal');
const subtotalBrutoEl = document.getElementById('subtotalBruto'); const diskonRegulerEl = document.getElementById('diskonReguler'); const diskonStrataEl = document.getElementById('diskonStrata'); const diskonTambahanEl = document.getElementById('diskonTambahan'); const totalFakturEl = document.getElementById('totalFaktur'); const diskonCODEl = document.getElementById('diskonCOD'); const potonganVoucherEl = document.getElementById('potonganVoucher'); const totalNettOnFakturEl = document.getElementById('totalNettOnFaktur'); const sisaTagihanEl = document.getElementById('sisaTagihan');


// --- Fungsi Helper ---
function formatRupiah(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0); }
function formatAngka(angka) { return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(angka || 0); }
async function fetchSheetData(gid) { const url = `${GOOGLE_SHEET_URL}&gid=${gid}&single=true&output=csv`; return new Promise((resolve, reject) => { Papa.parse(url, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true, complete: (results) => { console.log(`Data GID ${gid} berhasil dimuat.`); resolve(results.data); }, error: (err) => { console.error(`Gagal memuat GID ${gid}:`, err); reject(err); } }); }); }
function cleanStrataData(data) { const strataGroups = Object.keys(data[0]).filter(k => k.toUpperCase() !== 'QTY'); return data.map(row => { if (typeof row.QTY === 'string') { row.QTY = parseInt(row.QTY.replace(/[^0-9]/g, '')) || 0; } for (const group of strataGroups) { let val = row[group]; if (typeof val === 'string') { row[group] = parseInt(val.replace(/[^0-9]/g, '')) || 0; } else if (val === null || val === undefined) { row[group] = 0; } } return row; }).sort((a, b) => a.QTY - b.QTY); }
function cleanTierData(data, key) { return data.map(row => ({ ...row })).sort((a, b) => b[key] - a[key]); }
function toggleSummaryPanel() { summaryPanelEl.classList.toggle('summary-visible'); const isVisible = summaryPanelEl.classList.contains('summary-visible'); toggleSummaryBtn.textContent = isVisible ? '🛒 Sembunyikan Ringkasan' : '🛒 Lihat Ringkasan'; document.body.style.overflow = isVisible ? 'hidden' : 'auto'; }


// --- Fungsi Inisialisasi ---
async function init() {
    try {
        const [ produkData, regData, strataData, tamData, codData, loyData ] = await Promise.all([ fetchSheetData(GID_PRODUK), fetchSheetData(GID_REGULER), fetchSheetData(GID_STRATA), fetchSheetData(GID_TAMBAHAN), fetchSheetData(GID_COD), fetchSheetData(GID_LOYALTI) ]);
        dbProduk.clear(); produkData.forEach(p => { const hargaKarton = p['HARGA (INC PPN)']; const boxPerKrt = p.BOX_PER_CRT || 1; const pcsPerBox = p.PCS_PER_BOX || 1; p.HargaKarton = hargaKarton; p.HargaKarton_belum_ppn = hargaKarton / PPN_RATE; p.HargaBox = hargaKarton / boxPerKrt; p.HargaPcs = p.HargaBox / pcsPerBox; if (p.KD_SKU_PARENT !== null && p.KD_SKU_PARENT !== undefined) { const skuString = String(p.KD_SKU_PARENT); dbProduk.set(skuString, p); } else { console.warn("Ditemukan produk tanpa KD_SKU_PARENT:", p); } }); console.log(`dbProduk Map dibuat dengan ${dbProduk.size} entri.`);
        dbReguler = cleanTierData(regData, 'NOMINAL FAKTUR'); dbCOD = cleanTierData(codData, 'NOMINAL FAKTUR'); dbTambahan = tamData; promoTambahanMap.clear(); dbTambahan.forEach(promo => { if (promo.GROUP) { promoTambahanMap.set(promo.GROUP, promo); } }); dbLoyalti = loyData; dbStrata = cleanStrataData(strataData);
        buildMenu(); buildDropdowns();
        loadingEl.style.display = 'none'; containerEl.style.display = 'flex';
        kelasPelangganEl.addEventListener('change', renderSimulasi); inputVoucherEl.addEventListener('input', renderSimulasi); closeModalBtn.addEventListener('click', () => modalEl.style.display = 'none'); window.addEventListener('click', (event) => { if (event.target == modalEl) { modalEl.style.display = 'none'; } }); btnResetEl.addEventListener('click', resetAplikasi); toggleSummaryBtn.addEventListener('click', toggleSummaryPanel); closeSummaryBtn.addEventListener('click', toggleSummaryPanel); searchInputEl.addEventListener('input', filterMenu);
    } catch (error) { loadingEl.innerText = `Gagal memuat data. Periksa GID atau URL Google Sheet. Error: ${error.message}`; console.error("Kesalahan Inisialisasi:", error); }
}

// --- Fungsi Membangun Tampilan (Menu) ---
function buildMenu() { const groupedProduk = {}; dbProduk.forEach(p => { const group = p.ECERAN || 'LAIN-LAIN'; if (!groupedProduk[group]) groupedProduk[group] = []; groupedProduk[group].push(p); }); menuContainerEl.innerHTML = ''; const displayedGroups = new Set(); let finalGroupOrder = []; CUSTOM_GROUP_ORDER.forEach(groupName => { if (groupedProduk[groupName]) { finalGroupOrder.push(groupName); displayedGroups.add(groupName); } }); Object.keys(groupedProduk).sort().forEach(groupName => { if (!displayedGroups.has(groupName)) finalGroupOrder.push(groupName); }); console.log("Urutan Grup Menu:", finalGroupOrder); for (const groupName of finalGroupOrder) { const items = groupedProduk[groupName]; let itemHTML = ''; items.forEach(p => { itemHTML += `<div class="kartu-produk" data-sku="${String(p.KD_SKU_PARENT)}"><div><div class="nama-item">${p.NAMA_SKU_PARENT}</div><div class="harga-item">${formatRupiah(p.HargaKarton)}/Krt | ${p.BOX_PER_CRT} Box/Krt | ${p.PCS_PER_BOX} Pcs/Box</div></div><div class="input-qty"><input type="number" min="0" placeholder="Krt" class="input-krt" data-sku="${String(p.KD_SKU_PARENT)}"><input type="number" min="0" placeholder="Box" class="input-box" data-sku="${String(p.KD_SKU_PARENT)}"></div></div>`; }); const promoInfo = promoTambahanMap.get(groupName); let promoTambahanBtnHTML = ''; if (promoInfo) promoTambahanBtnHTML = `<button class="promo-tambahan-btn" data-group="${groupName}">🎁 Info Promo Tambahan</button>`; let strataInfoBtnHTML = ''; const hasStrataPromo = dbStrata.length > 0 && dbStrata[0].hasOwnProperty(groupName) && dbStrata.some(tier => tier[groupName] > 0); if (hasStrataPromo) strataInfoBtnHTML = `<button class="strata-info-btn" data-stratagroup="${groupName}">Info Strata (${groupName})</button>`; const groupHTML = `<div class="grup-produk" data-group-name="${groupName}"><div class="grup-header"><h3>Grup Strata: ${groupName}</h3><div class="grup-header-tombol">${promoTambahanBtnHTML}${strataInfoBtnHTML}</div></div>${itemHTML}</div>`; menuContainerEl.innerHTML += groupHTML; } menuContainerEl.querySelectorAll('.input-krt, .input-box').forEach(input => { input.addEventListener('change', updateKeranjang); }); menuContainerEl.querySelectorAll('.strata-info-btn').forEach(btn => { btn.addEventListener('click', showStrataInfo); }); menuContainerEl.querySelectorAll('.promo-tambahan-btn').forEach(btn => { btn.addEventListener('click', showPromoTambahanInfo); }); }
function filterMenu() { const searchTerm = searchInputEl.value.toLowerCase().trim(); const productCards = menuContainerEl.querySelectorAll('.kartu-produk'); const groupSections = menuContainerEl.querySelectorAll('.grup-produk'); productCards.forEach(card => { const productName = card.querySelector('.nama-item').textContent.toLowerCase(); if (productName.includes(searchTerm)) card.classList.remove('hidden'); else card.classList.add('hidden'); }); groupSections.forEach(group => { const visibleItemsInGroup = group.querySelectorAll('.kartu-produk:not(.hidden)'); if (visibleItemsInGroup.length === 0) group.classList.add('hidden'); else group.classList.remove('hidden'); }); }
function buildDropdowns() { kelasPelangganEl.innerHTML = '<option value="">- Pilih Kelas -</option>'; dbLoyalti.forEach(item => { kelasPelangganEl.innerHTML += `<option value="${item.KELAS}">${item.KELAS} (${item.REWARD * 100}%)</option>`; }); }
function showStrataInfo(event) { const strataGroup = event.target.dataset.stratagroup; let infoText = `QTY Karton | Potongan/Karton\n----------------------------\n`; let lastShownPotongan = -1; if (dbStrata.length > 0 && dbStrata[0].hasOwnProperty(strataGroup)) { dbStrata.forEach(tier => { const currentPotongan = tier[strataGroup] || 0; if (currentPotongan > 0 && currentPotongan > lastShownPotongan) { infoText += `${tier.QTY} Krt      | ${formatRupiah(currentPotongan)}\n`; lastShownPotongan = currentPotongan; } }); if (lastShownPotongan < 0) infoText += "(Tidak ada potongan aktif untuk grup ini)\n"; } else { infoText = `Tidak ada aturan strata yang ditemukan untuk grup ${strataGroup}.`; } modalTitleEl.innerText = `Info Strata (${strataGroup})`; modalContentEl.innerText = infoText; modalEl.style.display = 'block'; }
function showPromoTambahanInfo(event) { const groupName = event.target.dataset.group; const promoInfo = promoTambahanMap.get(groupName); let infoText = ""; if (promoInfo) { infoText += `Deskripsi    : Promo ${promoInfo.GROUP}\nMinimal Qty  : ${promoInfo.QTY} Karton\nMinimal Item : ${promoInfo.ITEM} item berbeda\nPotongan     : ${formatRupiah(promoInfo.POT)} / Karton\n`; } else { infoText = `Tidak ada promo tambahan untuk grup ${groupName}.`; } modalTitleEl.innerText = `Info Promo Tambahan (${groupName})`; modalContentEl.innerText = infoText; modalEl.style.display = 'block'; }
function resetAplikasi() { keranjang.clear(); menuContainerEl.querySelectorAll('.input-krt, .input-box').forEach(input => { input.value = ''; }); kelasPelangganEl.value = ''; inputVoucherEl.value = '0'; searchInputEl.value = ''; filterMenu(); renderSimulasi(); if (summaryPanelEl.classList.contains('summary-visible')) toggleSummaryPanel(); }
function updateKeranjang(event) { const sku = String(event.target.dataset.sku); const isKarton = event.target.classList.contains('input-krt'); const value = parseInt(event.target.value) || 0; let item = keranjang.get(sku) || { sku: sku, qtyKarton: 0, qtyBox: 0, diskonDetail: {} }; if (isKarton) item.qtyKarton = value; else item.qtyBox = value; if (item.qtyKarton > 0 || item.qtyBox > 0) keranjang.set(sku, item); else keranjang.delete(sku); renderSimulasi(); }

// --- FUNGSI KERANJANG & UPSELL STRATA ---
function renderKeranjang(totalKartonPerEceran) {
    if (keranjang.size === 0) { keranjangEl.innerHTML = '<p>(Keranjang kosong)</p>'; return; }
    keranjangEl.innerHTML = '';
    const keranjangGroupOrder = Object.keys(totalKartonPerEceran).sort((a,b) => (CUSTOM_GROUP_ORDER.indexOf(a) === -1 ? Infinity : CUSTOM_GROUP_ORDER.indexOf(a)) - (CUSTOM_GROUP_ORDER.indexOf(b) === -1 ? Infinity : CUSTOM_GROUP_ORDER.indexOf(b)));
    for (const eceran of keranjangGroupOrder) {
        const qtyGrup = totalKartonPerEceran[eceran];
        let grupHTML = `<div class="keranjang-grup-header">${eceran} (Total ${formatAngka(qtyGrup)} Krt)</div>`;
        let itemListHTML = '<ul class="keranjang-item-list">';
        keranjang.forEach(item => {
            const skuString = String(item.sku); const produk = dbProduk.get(skuString);
            if (produk && produk.ECERAN === eceran) {
                const hargaNettKarton = item.diskonDetail?.hargaNettKarton || produk.HargaKarton;
                let hargaAkhirHTML = '';
                if (produk.ITEM_LOYALTI === 'Y') {
                    const hargaNettAkhirKarton = item.diskonDetail?.hargaNettAkhirKarton || hargaNettKarton;
                    hargaAkhirHTML = `<span style="color: #0056b3; font-weight: bold; margin-left: 5px;">* ${formatRupiah(hargaNettAkhirKarton)} / Krt</span><small style="display: block; color: #0056b3; font-size: 0.8em;">(* Harga stlh cashback)</small>`;
                }
                itemListHTML += `<li><div class="keranjang-item-info"><strong>${produk.NAMA_SKU_PARENT}</strong><br>(${item.qtyKarton} Krt, ${item.qtyBox} Box)</div><div class="keranjang-item-harga">${formatRupiah(hargaNettKarton)} / Krt<button class="detail-item-btn" data-sku="${skuString}">Detail</button>${hargaAkhirHTML}<small style="display: block; text-decoration: line-through; color: #999; margin-top: 3px;">${formatRupiah(produk.HargaKarton)} / Krt</small></div></li>`;
            }
        });
        itemListHTML += '</ul>';
        let currentPotongan_bppn = 0; // Cari potongan sebelum PPN saat ini
        const currentTierData = [...dbStrata].reverse().find(tier => qtyGrup >= tier.QTY && tier[eceran] > 0);
        if (currentTierData) currentPotongan_bppn = currentTierData[eceran];
        // Cari tier berikutnya dengan potongan sebelum PPN lebih tinggi
        const nextUpsellTierData = dbStrata.find(tier => tier.QTY > qtyGrup && tier[eceran] > currentPotongan_bppn);
        let upsellStrataHTML = '';
        if (nextUpsellTierData) {
            const qtyDibutuhkan = nextUpsellTierData.QTY - qtyGrup;
            upsellStrataHTML = `<div class="keranjang-upsell-strata">📈 Tambah <strong>${formatAngka(qtyDibutuhkan)} Krt</strong> lagi (total ${nextUpsellTierData.QTY} Krt) untuk dapat potongan ${formatRupiah(nextUpsellTierData[eceran])}/Krt.</div>`; // Tampilkan potongan dari tabel
        } else {
            upsellStrataHTML = `<div class="keranjang-upsell-strata tertinggi">🏆 Anda sudah di tier Strata tertinggi.</div>`;
        }
        keranjangEl.innerHTML += grupHTML + itemListHTML + upsellStrataHTML;
    }
    keranjangEl.querySelectorAll('.detail-item-btn').forEach(btn => { btn.addEventListener('click', showDiscountDetails); });
}

// --- FUNGSI UPSELL REGULER ---
function renderUpsellReguler(totalBrutoPerGrup_belum_ppn) { let recommendations = []; for (const grup in totalBrutoPerGrup_belum_ppn) { const brutoGrup_bppn = totalBrutoPerGrup_belum_ppn[grup]; let currentTierIndex = -1; for (let i = 0; i < dbReguler.length; i++) { if (brutoGrup_bppn >= dbReguler[i]['NOMINAL FAKTUR']) { currentTierIndex = i; break; } } let nextTier = null; if (currentTierIndex === -1 && dbReguler.length > 0) { const lowestTier = dbReguler[dbReguler.length - 1]; if(lowestTier[grup] > 0) nextTier = lowestTier; } else if (currentTierIndex > 0) { const higherTier = dbReguler[currentTierIndex - 1]; if(higherTier[grup] > (dbReguler[currentTierIndex][grup] || 0)) nextTier = higherTier; } if (nextTier) { const rpDibutuhkan_bppn = nextTier['NOMINAL FAKTUR'] - brutoGrup_bppn; if (rpDibutuhkan_bppn > 0) { const diskonBaru = nextTier[grup] * 100; recommendations.push(`<li><strong>${grup}:</strong> Tambah Bruto (sblm PPN) <strong>${formatRupiah(rpDibutuhkan_bppn)}</strong> lagi (total ${formatRupiah(nextTier['NOMINAL FAKTUR'])}) untuk dapat diskon ${formatAngka(diskonBaru)}%.</li>`); } } else if (currentTierIndex === 0) recommendations.push(`<li><strong>${grup}:</strong> 🏆 Anda sudah di tier Reguler tertinggi.</li>`); } if (recommendations.length > 0) upsellRegulerEl.innerHTML = recommendations.join(''); else upsellRegulerEl.innerHTML = '<li>(Tambahkan item untuk melihat rekomendasi)</li>'; }

// --- FUNGSI DETAIL DISKON (Pop-up) ---
function showDiscountDetails(event) {
    const sku = String(event.target.dataset.sku); const keranjangItem = keranjang.get(sku); const produk = dbProduk.get(sku); if (!keranjangItem || !produk) { alert("Gagal mendapatkan detail item."); return; }
    const detail = keranjangItem.diskonDetail || {};
    let infoText = `Rincian Harga Nett per Karton untuk:\n${produk.NAMA_SKU_PARENT}\n--------------------------------------\n`;
    infoText += `Harga Awal (Inc PPN) : ${formatRupiah(produk.HargaKarton)}\n`;
    infoText += `- Diskon Reguler     : ${formatRupiah(detail.regulerPerKarton || 0)}\n`; // Ini sudah Inc PPN
    // Menampilkan potongan SEBELUM PPN
    infoText += `- Potongan Strata    : ${formatRupiah(detail.strataPerKarton_bppn || 0)}\n`;
    infoText += `- Potongan Tambahan  : ${formatRupiah(detail.tambahanPerKarton_bppn || 0)}\n`;
    // Harga sebelum COD (Inc PPN)
    const hargaSebelumCOD = produk.HargaKarton - (detail.regulerPerKarton || 0) - (detail.strataPerKarton_bppn * PPN_RATE || 0) - (detail.tambahanPerKarton_bppn * PPN_RATE || 0);
    infoText += `--------------------------------------\nSubtotal (Inc PPN)   : ${formatRupiah(hargaSebelumCOD)}\n`;
    infoText += `- Diskon COD         : ${formatRupiah(detail.codPerKarton || 0)}\n`; // Ini sudah Inc PPN
    infoText += `======================================\nHARGA NETT ON-FAKTUR : ${formatRupiah(detail.hargaNettKarton || 0)}\n\n`;
    if (produk.ITEM_LOYALTI === 'Y') {
        infoText += `--- Simulasi Tambahan ---\n`;
        infoText += `- Cashback Loyalti   : ${formatRupiah(detail.loyaltiPerKarton || 0)}\n`;
        infoText += `======================================\n* HARGA NETT AKHIR   : ${formatRupiah(detail.hargaNettAkhirKarton || 0)}\n`;
    }
    modalTitleEl.innerText = `Detail Diskon: ${produk.NAMA_SKU_PARENT}`; modalContentEl.innerText = infoText; modalEl.style.display = 'block';
}


// ==========================================================
// FUNGSI LOGIKA INTI
// ==========================================================
function renderSimulasi() {
    // 1. Hitung Total Bruto & Agregasi (Inc PPN dan Belum PPN)
    let subtotalBruto = 0; let totalNilaiLoyalti = 0; let totalBrutoPerGrup = {}; let totalKartonPerEceran = {}; let distinctItemsPerEceran = {}; let brutoPerItemLoyalti = new Map();
    let subtotalBruto_belum_ppn = 0; let totalBrutoPerGrup_belum_ppn = {};
    keranjang.forEach((item, skuKey) => { const skuString = String(skuKey); const produk = dbProduk.get(skuString); if (!produk) return; const qtyKartonValid = !isNaN(item.qtyKarton) ? item.qtyKarton : 0; const qtyBoxValid = !isNaN(item.qtyBox) ? item.qtyBox : 0; const hargaKartonValid = !isNaN(produk.HargaKarton) ? produk.HargaKarton : 0; const hargaBoxValid = !isNaN(produk.HargaBox) ? produk.HargaBox : 0; const hargaKarton_bppn = !isNaN(produk.HargaKarton_belum_ppn) ? produk.HargaKarton_belum_ppn : 0; const hargaBox_bppn = hargaKarton_bppn / (produk.BOX_PER_CRT || 1); const boxPerCrtValid = (produk.BOX_PER_CRT && !isNaN(produk.BOX_PER_CRT) && produk.BOX_PER_CRT !== 0) ? produk.BOX_PER_CRT : 1; const totalBrutoItem = (qtyKartonValid * hargaKartonValid) + (qtyBoxValid * hargaBoxValid); const totalBrutoItem_bppn = (qtyKartonValid * hargaKarton_bppn) + (qtyBoxValid * hargaBox_bppn); const totalKartonItem = qtyKartonValid + (qtyBoxValid / boxPerCrtValid); if (isNaN(totalBrutoItem) || isNaN(totalKartonItem) || isNaN(totalBrutoItem_bppn)) return; const grupReguler = produk.GROUP; const grupEceran = produk.ECERAN; if (!grupReguler || !grupEceran) return; subtotalBruto += totalBrutoItem; subtotalBruto_belum_ppn += totalBrutoItem_bppn; totalBrutoPerGrup[grupReguler] = (totalBrutoPerGrup[grupReguler] || 0) + totalBrutoItem; totalBrutoPerGrup_belum_ppn[grupReguler] = (totalBrutoPerGrup_belum_ppn[grupReguler] || 0) + totalBrutoItem_bppn; totalKartonPerEceran[grupEceran] = (totalKartonPerEceran[grupEceran] || 0) + totalKartonItem; if (!distinctItemsPerEceran[grupEceran]) distinctItemsPerEceran[grupEceran] = new Set(); distinctItemsPerEceran[grupEceran].add(skuString); if (produk.ITEM_LOYALTI === 'Y') { totalNilaiLoyalti += totalBrutoItem; brutoPerItemLoyalti.set(skuString, totalBrutoItem); } item.diskonDetail = {}; });
    subtotalBrutoEl.innerText = formatRupiah(subtotalBruto);
    renderUpsellReguler(totalBrutoPerGrup_belum_ppn);

    // 3. Diskon #1: Reguler (Cek Tier: Belum PPN, Hitung Diskon: Inc PPN)
    let totalDiskonReguler = 0; let persenDiskonRegulerPerGrup = {};
    for (const grup in totalBrutoPerGrup_belum_ppn) {
        const brutoGrup_bppn = totalBrutoPerGrup_belum_ppn[grup]; const brutoGrup_inc_ppn = totalBrutoPerGrup[grup] || 0; persenDiskonRegulerPerGrup[grup] = 0; if (dbReguler.length > 0 && !(grup in dbReguler[0])) continue;
        const tier = dbReguler.find(t => brutoGrup_bppn >= t['NOMINAL FAKTUR']); // Cek _belum_ppn
        if (tier && tier[grup]) { persenDiskonRegulerPerGrup[grup] = tier[grup]; totalDiskonReguler += brutoGrup_inc_ppn * tier[grup]; } // Hitung dari inc PPN
    }
    diskonRegulerEl.innerText = `- ${formatRupiah(totalDiskonReguler)}`;

    // 4. Diskon #2: Strata (Potongan tetap dari tabel = _bppn)
    let totalPotonganStrata_bppn = 0; let potonganStrataPerKartonPerEceran_bppn = {};
    for (const eceran in totalKartonPerEceran) {
        const qtyGrup = totalKartonPerEceran[eceran]; potonganStrataPerKartonPerEceran_bppn[eceran] = 0; if (dbStrata.length > 0 && !(eceran in dbStrata[0])) continue;
        const currentTier = [...dbStrata].reverse().find(tier => qtyGrup >= tier.QTY && tier[eceran] > 0);
        if (currentTier) { const potonganPerKarton_bppn = currentTier[eceran]; potonganStrataPerKartonPerEceran_bppn[eceran] = potonganPerKarton_bppn; totalPotonganStrata_bppn += qtyGrup * potonganPerKarton_bppn; }
    }
    // Tampilkan potongan SEBELUM PPN
    diskonStrataEl.innerText = `- ${formatRupiah(totalPotonganStrata_bppn)}`;

    // 5. Diskon #3: Tambahan (Potongan tetap dari tabel = _bppn)
    let totalPotonganTambahan_bppn = 0; let potonganTambahanPerKartonPerEceran_bppn = {};
    dbTambahan.forEach(promo => { const grupPromo = promo.GROUP; const qtyMin = promo.QTY; const itemMin = promo.ITEM; const potongan_bppn = promo.POT; const qtyGroupActual = totalKartonPerEceran[grupPromo] || 0; const distinctItemsInGroup = distinctItemsPerEceran[grupPromo]?.size || 0; if (qtyGroupActual >= qtyMin && distinctItemsInGroup >= itemMin) { potonganTambahanPerKartonPerEceran_bppn[grupPromo] = (potonganTambahanPerKartonPerEceran_bppn[grupPromo] || 0) + potongan_bppn; totalPotonganTambahan_bppn += qtyGroupActual * potongan_bppn; } });
    // Tampilkan potongan SEBELUM PPN
    diskonTambahanEl.innerText = `- ${formatRupiah(totalPotonganTambahan_bppn)}`;

    // 6. Hitung Total Faktur (Inc PPN, sebelum COD)
    // Pengurangan Strata & Tambahan menggunakan nilai _bppn * PPN_RATE
    const totalFaktur = subtotalBruto - totalDiskonReguler - (totalPotonganStrata_bppn * PPN_RATE) - (totalPotonganTambahan_bppn * PPN_RATE);
    totalFakturEl.innerText = formatRupiah(totalFaktur);

    // 7. Hitung Diskon #4: COD (Cek Tier: Belum PPN, Hitung Diskon: Inc PPN dari totalFaktur)
    let totalDiskonCOD = 0; let persenCOD = 0; const metodeBayar = 'COD';
    if (metodeBayar === 'COD') {
        const tier = dbCOD.find(t => subtotalBruto_belum_ppn >= t['NOMINAL FAKTUR']); // Cek pakai subtotal bruto _belum_ppn
        if (tier) { persenCOD = tier.COD; totalDiskonCOD = totalFaktur * persenCOD; } // Hitung dari totalFaktur (Inc PPN sebelum COD)
    }
    diskonCODEl.innerText = `- ${formatRupiah(totalDiskonCOD)}`;

    // 10a. Dapatkan persen Loyalti dulu
    let persenLoyalti = 0; const kelasLoyalti = kelasPelangganEl.value; const tierLoyalti = dbLoyalti.find(t => t.KELAS === kelasLoyalti); if (tierLoyalti) { persenLoyalti = tierLoyalti.REWARD; }

    // Hitung & Simpan Detail Diskon per Item
    keranjang.forEach(item => {
        const skuString = String(item.sku); const produk = dbProduk.get(skuString); if (!produk) return;
        const grupReguler = produk.GROUP; const grupEceran = produk.ECERAN;

        // Diskon/Potongan per KARTON
        const diskonRegulerItem_inc_ppn = produk.HargaKarton * (persenDiskonRegulerPerGrup[grupReguler] || 0); // Inc PPN
        const potonganStrataItem_bppn = potonganStrataPerKartonPerEceran_bppn[grupEceran] || 0; // Belum PPN
        const potonganTambahanItem_bppn = potonganTambahanPerKartonPerEceran_bppn[grupEceran] || 0; // Belum PPN

        // Harga setelah diskon on-faktur (Reg, Strata, Tam) per KARTON (INC PPN)
        const hargaSetelahOnFakturItem_inc_ppn = produk.HargaKarton - diskonRegulerItem_inc_ppn - (potonganStrataItem_bppn * PPN_RATE) - (potonganTambahanItem_bppn * PPN_RATE);

        // Diskon COD per KARTON (INC PPN) - Proporsional dari hargaSetelahOnFakturItem
        const diskonCODItem_inc_ppn = hargaSetelahOnFakturItem_inc_ppn * persenCOD;

        // Harga Nett On Faktur per KARTON (INC PPN)
        const hargaNettKartonItem_inc_ppn = hargaSetelahOnFakturItem_inc_ppn - diskonCODItem_inc_ppn;

        // Hitung Loyalti per KARTON (Basis: Nett On Faktur INC PPN)
        const diskonLoyaltiItem = produk.ITEM_LOYALTI === 'Y' ? hargaNettKartonItem_inc_ppn * persenLoyalti : 0;
        const hargaNettAkhirKartonItem = hargaNettKartonItem_inc_ppn - diskonLoyaltiItem;

        // Simpan detail Inc PPN dan _bppn
        item.diskonDetail = {
            // Basis Belum PPN (untuk detail pop-up)
            strataPerKarton_bppn: potonganStrataItem_bppn,
            tambahanPerKarton_bppn: potonganTambahanItem_bppn,
            // Basis Inc PPN (untuk tampilan & kalkulasi akhir)
            regulerPerKarton: diskonRegulerItem_inc_ppn,
            codPerKarton: diskonCODItem_inc_ppn,
            hargaNettKarton: hargaNettKartonItem_inc_ppn,
            loyaltiPerKarton: diskonLoyaltiItem,
            hargaNettAkhirKarton: hargaNettAkhirKartonItem
        };
    });

    // 2. Render keranjang SETELAH detail diskon per item dihitung
    renderKeranjang(totalKartonPerEceran);

    // 8. Hitung Voucher (Pembayaran)
    const nilaiVoucherInput = parseFloat(inputVoucherEl.value) || 0; let nilaiVoucherTerpakai = nilaiVoucherInput; if (nilaiVoucherInput > totalNilaiLoyalti) nilaiVoucherTerpakai = totalNilaiLoyalti;
    potonganVoucherEl.innerText = `- ${formatRupiah(nilaiVoucherTerpakai)}`;

    // 9. Hitung Harga Nett On Faktur - TOTAL (Tagihan Akhir sebelum voucher)
    const hargaNettOnFaktur = totalFaktur - totalDiskonCOD; // Total Faktur dan Diskon COD sudah Inc PPN
    totalNettOnFakturEl.innerText = formatRupiah(hargaNettOnFaktur);

    // 10 & 11 Dihapus dari Ringkasan Total

    // Hitung dan tampilkan Sisa Tagihan
    const sisaTagihan = hargaNettOnFaktur - nilaiVoucherTerpakai;
    sisaTagihanEl.innerText = formatRupiah(sisaTagihan);
}


// --- Mulai aplikasi ---
document.addEventListener('DOMContentLoaded', init);






