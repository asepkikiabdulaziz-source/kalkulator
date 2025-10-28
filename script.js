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

// ==========================================================
// FILE: script.js - KALKULATOR SIMULASI DISKON GEMINI
// ==========================================================



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
// Ambil elemen-elemen DOM berdasarkan ID/Class yang sudah Anda tentukan
const loadingEl = document.getElementById('loading'); 
const containerEl = document.querySelector('.kalkulator-container'); 
const menuContainerEl = document.getElementById('menuContainer'); 
const keranjangEl = document.getElementById('daftarKeranjang'); 
const kelasPelangganEl = document.getElementById('kelasPelanggan'); 
const inputVoucherEl = document.getElementById('inputVoucher'); 
const upsellRegulerEl = document.getElementById('daftarUpsellReguler'); 
const btnResetEl = document.getElementById('btn-reset'); 
const searchInputEl = document.getElementById('search-input');
// Panel Slide-Up
const summaryPanelEl = document.querySelector('.simulasi-order');
const closeSummaryBtn = document.getElementById('close-summary-btn');
const summaryToggleBarEl = document.getElementById('summary-toggle-bar');
const summaryBarTotalEl = document.getElementById('summary-bar-total'); 
// Modal
const modalEl = document.getElementById('modalDetail'); 
const modalTitleEl = document.getElementById('modalTitle'); 
const modalContentEl = document.getElementById('modalDetailContent'); 
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
const sisaTagihanEl = document.getElementById('sisaTagihan');


// ==========================================================
// FUNGSI HELPER
// ==========================================================

function formatRupiah(angka) { 
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(angka || 0); 
}

function formatAngka(angka) { 
    return new Intl.NumberFormat('id-ID', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
    }).format(angka || 0); 
}

async function fetchSheetData(gid) { 
    const url = `${GOOGLE_SHEET_URL}&gid=${gid}&single=true&output=csv`; 
    return new Promise((resolve, reject) => { 
        if (typeof Papa === 'undefined') {
            reject(new Error("PapaParse library is not loaded."));
            return;
        }
        Papa.parse(url, { 
            download: true, 
            header: true, 
            dynamicTyping: true, 
            skipEmptyLines: true, 
            complete: (results) => { 
                resolve(results.data); 
            }, 
            error: (err) => { 
                reject(err); 
            } 
        }); 
    }); 
}

function cleanStrataData(data) { 
    const strataGroups = Object.keys(data[0]).filter(k => k.toUpperCase() !== 'QTY'); 
    return data.map(row => { 
        if (typeof row.QTY === 'string') { 
            row.QTY = parseInt(row.QTY.replace(/[^0-9]/g, '')) || 0; 
        } 
        for (const group of strataGroups) { 
            let val = row[group]; 
            if (typeof val === 'string') { 
                row[group] = parseInt(val.replace(/[^0-9]/g, '')) || 0; 
            } else if (val === null || val === undefined) { 
                row[group] = 0; 
            } 
        } 
        return row; 
    }).sort((a, b) => a.QTY - b.QTY); // Urutkan QTY menaik
}

function cleanTierData(data, key) { 
    // Urutkan berdasarkan nominal faktur (key) menurun
    return data.map(row => ({ ...row })).sort((a, b) => b[key] - a[key]); 
}

function toggleSummaryPanel() { 
    summaryPanelEl.classList.toggle('summary-visible'); 
    const isVisible = summaryPanelEl.classList.contains('summary-visible'); 
    document.body.style.overflow = isVisible ? 'hidden' : 'auto'; 
}


// ==========================================================
// FUNGSI INISIALISASI & UI
// ==========================================================

async function init() {
    try {
        const [ produkData, regData, strataData, tamData, codData, loyData ] = await Promise.all([ 
            fetchSheetData(GID_PRODUK), fetchSheetData(GID_REGULER), fetchSheetData(GID_STRATA), 
            fetchSheetData(GID_TAMBAHAN), fetchSheetData(GID_COD), fetchSheetData(GID_LOYALTI) 
        ]);

        // 1. Inisialisasi dbProduk
        dbProduk.clear(); 
        produkData.forEach(p => { 
            const hargaKarton = p['HARGA (INC PPN)'] || 0; 
            const boxPerKrt = p.BOX_PER_CRT || 1; 
            const pcsPerBox = p.PCS_PER_BOX || 1; 
            
            p.BOX_PER_CRT = parseInt(boxPerKrt) || 1; 
            p.PCS_PER_BOX = parseInt(pcsPerBox) || 1; 
            p['HARGA (INC PPN)'] = parseFloat(hargaKarton) || 0;

            p.HargaKarton = hargaKarton; 
            p.HargaKarton_belum_ppn = hargaKarton / PPN_RATE; 
            p.HargaBox = hargaKarton / p.BOX_PER_CRT; 
            p.HargaPcs = p.HargaBox / p.PCS_PER_BOX; 
            
            if (p.KD_SKU_PARENT !== null && p.KD_SKU_PARENT !== undefined) { 
                dbProduk.set(String(p.KD_SKU_PARENT), p); 
            } 
        }); 

        // 2. Inisialisasi Database Lain
        dbReguler = cleanTierData(regData, 'NOMINAL FAKTUR'); 
        dbCOD = cleanTierData(codData, 'NOMINAL FAKTUR'); 
        dbTambahan = tamData.map(promo => ({
            ...promo,
            QTY: parseInt(promo.QTY) || 0,
            ITEM: parseInt(promo.ITEM) || 0,
            POT: parseFloat(promo.POT) || 0
        })); 
        promoTambahanMap.clear(); 
        dbTambahan.forEach(promo => { if (promo.GROUP) promoTambahanMap.set(promo.GROUP, promo); }); 
        dbLoyalti = loyData; 
        dbStrata = cleanStrataData(strataData);

        // 3. Membangun Tampilan & Listeners
        buildMenu(); 
        buildDropdowns();

        loadingEl.style.display = 'none'; 
        containerEl.style.display = 'flex';

        kelasPelangganEl.addEventListener('change', renderSimulasi); 
        inputVoucherEl.addEventListener('input', renderSimulasi); 
        closeModalBtn.addEventListener('click', () => modalEl.style.display = 'none'); 
        window.addEventListener('click', (event) => { if (event.target == modalEl) modalEl.style.display = 'none'; }); 
        btnResetEl.addEventListener('click', resetAplikasi);
        summaryToggleBarEl.addEventListener('click', toggleSummaryPanel); 
        closeSummaryBtn.addEventListener('click', toggleSummaryPanel); 
        searchInputEl.addEventListener('input', filterMenu);

        renderSimulasi(); // Panggil pertama kali

    } catch (error) { 
        loadingEl.innerText = `Gagal memuat data. Error: ${error.message}`; 
        console.error("Kesalahan Inisialisasi:", error); 
    }
}

function buildMenu() { 
    const groupedProduk = {}; 
    dbProduk.forEach(p => { 
        const group = p.ECERAN || 'LAIN-LAIN'; 
        if (!groupedProduk[group]) groupedProduk[group] = []; 
        groupedProduk[group].push(p); 
    }); 
    
    menuContainerEl.innerHTML = ''; 
    const finalGroupOrder = []; 
    const displayedGroups = new Set(); 
    
    // Urutkan Grup
    CUSTOM_GROUP_ORDER.forEach(groupName => { 
        if (groupedProduk[groupName]) { 
            finalGroupOrder.push(groupName); 
            displayedGroups.add(groupName); 
        } 
    }); 
    Object.keys(groupedProduk).sort().forEach(groupName => { 
        if (!displayedGroups.has(groupName)) finalGroupOrder.push(groupName); 
    }); 
    
    for (const groupName of finalGroupOrder) { 
        const items = groupedProduk[groupName]; 
        let itemHTML = ''; 
        
        items.forEach(p => { 
            const sku = String(p.KD_SKU_PARENT);
            const keranjangItem = keranjang.get(sku);
            const qtyKrt = keranjangItem ? keranjangItem.qtyKarton : '';
            const qtyBox = keranjangItem ? keranjangItem.qtyBox : '';

            itemHTML += `
                <div class="kartu-produk" data-sku="${sku}">
                    <div>
                        <div class="nama-item">${p.NAMA_SKU_PARENT}</div>
                        <div class="harga-item">${formatRupiah(p.HargaKarton)}/Krt | ${p.BOX_PER_CRT} Box/Krt | ${p.PCS_PER_BOX} Pcs/Box</div>
                    </div>
                    <div class="input-qty">
                        <input type="number" min="0" placeholder="Krt" class="input-krt" data-sku="${sku}" value="${qtyKrt}">
                        <input type="number" min="0" placeholder="Box" class="input-box" data-sku="${sku}" value="${qtyBox}">
                    </div>
                </div>
            `; 
        }); 
        
        const promoInfo = promoTambahanMap.get(groupName); 
        let promoTambahanBtnHTML = promoInfo && promoInfo.POT > 0 ? `<button class="promo-tambahan-btn" data-group="${groupName}">🎁 Info Promo Tambahan</button>` : ''; 
        
        const hasStrataPromo = dbStrata.length > 0 && dbStrata.some(tier => tier.hasOwnProperty(groupName) && tier[groupName] > 0); 
        let strataInfoBtnHTML = hasStrataPromo ? `<button class="strata-info-btn" data-stratagroup="${groupName}">Info Strata</button>` : ''; 
        
        const groupHTML = `
            <div class="grup-produk" data-group-name="${groupName}">
                <div class="grup-header">
                    <h3>Grup Strata: ${groupName}</h3>
                    <div class="grup-header-tombol">${promoTambahanBtnHTML}${strataInfoBtnHTML}</div>
                </div>
                ${itemHTML}
            </div>
        `; 
        menuContainerEl.innerHTML += groupHTML; 
    } 
    
    // Attach listeners
    menuContainerEl.querySelectorAll('.input-krt, .input-box').forEach(input => { 
        input.addEventListener('change', updateKeranjang); 
    }); 
    menuContainerEl.querySelectorAll('.strata-info-btn').forEach(btn => { 
        btn.addEventListener('click', showStrataInfo); 
    }); 
    menuContainerEl.querySelectorAll('.promo-tambahan-btn').forEach(btn => { 
        btn.addEventListener('click', showPromoTambahanInfo); 
    }); 
}

function filterMenu() { 
    const searchTerm = searchInputEl.value.toLowerCase().trim(); 
    const productCards = menuContainerEl.querySelectorAll('.kartu-produk'); 
    const groupSections = menuContainerEl.querySelectorAll('.grup-produk'); 
    
    productCards.forEach(card => { 
        const productName = card.querySelector('.nama-item').textContent.toLowerCase(); 
        if (productName.includes(searchTerm)) card.classList.remove('hidden'); 
        else card.classList.add('hidden'); 
    }); 
    
    groupSections.forEach(group => { 
        const visibleItemsInGroup = group.querySelectorAll('.kartu-produk:not(.hidden)'); 
        if (visibleItemsInGroup.length === 0) group.classList.add('hidden'); 
        else group.classList.remove('hidden'); 
    }); 
}

function buildDropdowns() { 
    kelasPelangganEl.innerHTML = '<option value="">- Pilih Kelas -</option>'; 
    dbLoyalti.forEach(item => { 
        kelasPelangganEl.innerHTML += `<option value="${item.KELAS}">${item.KELAS} (${(item.REWARD * 100).toFixed(0)}%)</option>`; 
    }); 
}

function showStrataInfo(event) { 
    const strataGroup = event.target.dataset.stratagroup; 
    let infoText = `QTY Karton | Potongan/Karton (Sebelum PPN)\n----------------------------\n`; 
    let lastShownPotongan = -1; 
    
    dbStrata.forEach(tier => { 
        const currentPotongan = tier[strataGroup] || 0;
        if (currentPotongan > 0 && currentPotongan > lastShownPotongan) { 
            infoText += `${tier.QTY} Krt      | ${formatRupiah(currentPotongan)}\n`; 
            lastShownPotongan = currentPotongan; 
        } 
    }); 
    
    if (lastShownPotongan < 0) infoText += "(Tidak ada potongan aktif untuk grup ini)\n"; 
    
    modalTitleEl.innerText = `Info Strata (${strataGroup})`; 
    modalContentEl.innerText = infoText; 
    modalEl.style.display = 'block'; 
}

function showPromoTambahanInfo(event) { 
    const groupName = event.target.dataset.group; 
    const promoInfo = promoTambahanMap.get(groupName); 
    let infoText = "Tidak ada promo tambahan."; 
    
    if (promoInfo) { 
        infoText = `Deskripsi    : Promo ${promoInfo.GROUP}\n`;
        infoText += `Minimal Qty  : ${promoInfo.QTY} Karton\n`;
        infoText += `Minimal Item : ${promoInfo.ITEM} item berbeda\n`;
        infoText += `Potongan     : ${formatRupiah(promoInfo.POT)} / Karton (BPPN)\n`;
    } 
    
    modalTitleEl.innerText = `Info Promo Tambahan (${groupName})`; 
    modalContentEl.innerText = infoText; 
    modalEl.style.display = 'block'; 
}

function resetAplikasi() { 
    keranjang.clear(); 
    menuContainerEl.querySelectorAll('.input-krt, .input-box').forEach(input => { 
        input.value = ''; 
    }); 
    kelasPelangganEl.value = ''; 
    inputVoucherEl.value = '0'; 
    searchInputEl.value = ''; 
    filterMenu(); 
    renderSimulasi(); 
    if (summaryPanelEl.classList.contains('summary-visible')) toggleSummaryPanel(); 
}

function updateKeranjang(event) { 
    const sku = String(event.target.dataset.sku); 
    const isKarton = event.target.classList.contains('input-krt'); 
    const value = parseInt(event.target.value) || 0; 
    
    let item = keranjang.get(sku) || { sku: sku, qtyKarton: 0, qtyBox: 0, diskonDetail: {} }; 
    
    if (isKarton) 
        item.qtyKarton = value; 
    else 
        item.qtyBox = value; 
    
    if (item.qtyKarton > 0 || item.qtyBox > 0) 
        keranjang.set(sku, item); 
    else 
        keranjang.delete(sku); 
        
    renderSimulasi(); 
}

function showDiscountDetails(event) {
    const sku = String(event.target.dataset.sku); 
    const keranjangItem = keranjang.get(sku); 
    const produk = dbProduk.get(sku); 
    
    if (!keranjangItem || !produk) { alert("Gagal mendapatkan detail item."); return; }
    
    const detail = keranjangItem.diskonDetail || {};
    
    const potonganStrataItem_inc_ppn = detail.strataPerKarton_bppn * PPN_RATE;
    const potonganTambahanItem_inc_ppn = detail.tambahanPerKarton_bppn * PPN_RATE;

    const hargaSetelahCOD = produk.HargaKarton - (detail.regulerPerKarton || 0) - potonganStrataItem_inc_ppn - potonganTambahanItem_inc_ppn;
    
    let infoText = `Rincian Harga Nett per Karton untuk:\n${produk.NAMA_SKU_PARENT}\n--------------------------------------\n`;
    infoText += `Harga Awal (Inc PPN) : ${formatRupiah(produk.HargaKarton)}\n`;
    infoText += `- Diskon Reguler     : ${formatRupiah(detail.regulerPerKarton || 0)}\n`; 
    infoText += `- Potongan Strata    : ${formatRupiah(detail.strataPerKarton_bppn || 0)} (BPPN)\n`;
    infoText += `- Potongan Tambahan  : ${formatRupiah(detail.tambahanPerKarton_bppn || 0)} (BPPN)\n`;
    
    infoText += `--------------------------------------\nSubtotal (Inc PPN)   : ${formatRupiah(hargaSetelahCOD)}\n`;
    infoText += `- Diskon COD         : ${formatRupiah(detail.codPerKarton || 0)}\n`; 
    infoText += `======================================\nHARGA NETT ON-FAKTUR : ${formatRupiah(detail.hargaNettKarton || 0)}\n\n`;
    
    if (produk.ITEM_LOYALTI === 'Y') {
        infoText += `--- Simulasi Tambahan ---\n`;
        infoText += `- Cashback Loyalti   : ${formatRupiah(detail.loyaltiPerKarton || 0)}\n`;
        infoText += `======================================\n* HARGA NETT AKHIR   : ${formatRupiah(detail.hargaNettAkhirKarton || 0)}\n`;
    }
    
    modalTitleEl.innerText = `Detail Diskon: ${produk.NAMA_SKU_PARENT}`; 
    modalContentEl.innerText = infoText; 
    modalEl.style.display = 'block';
}

function renderKeranjang(totalKartonPerEceran) {
    if (keranjang.size === 0) { keranjangEl.innerHTML = '<p>(Keranjang kosong)</p>'; return; }
    
    keranjangEl.innerHTML = '';
    
    const keranjangGroupOrder = Object.keys(totalKartonPerEceran).sort((a,b) => (CUSTOM_GROUP_ORDER.indexOf(a) === -1 ? Infinity : CUSTOM_GROUP_ORDER.indexOf(a)) - (CUSTOM_GROUP_ORDER.indexOf(b) === -1 ? Infinity : CUSTOM_GROUP_ORDER.indexOf(b)));
    
    for (const eceran of keranjangGroupOrder) {
        const qtyGrup = totalKartonPerEceran[eceran];
        let grupHTML = `<div class="keranjang-grup-header">${eceran} (Total ${formatAngka(qtyGrup)} Krt)</div>`;
        let itemListHTML = '<ul class="keranjang-item-list">';
        
        const itemsInGroup = Array.from(keranjang.values()).filter(item => {
            const produk = dbProduk.get(String(item.sku));
            return produk && produk.ECERAN === eceran;
        });

        itemsInGroup.forEach(item => {
            const skuString = String(item.sku); 
            const produk = dbProduk.get(skuString);
            
            if (produk) {
                const hargaNettKarton = item.diskonDetail?.hargaNettKarton || produk.HargaKarton;
                let hargaAkhirHTML = '';
                
                if (produk.ITEM_LOYALTI === 'Y') {
                    const hargaNettAkhirKarton = item.diskonDetail?.hargaNettAkhirKarton || hargaNettKarton;
                    hargaAkhirHTML = `<span style="color: #0056b3; font-weight: bold; margin-left: 5px;">* ${formatRupiah(hargaNettAkhirKarton)} / Krt</span><small style="display: block; color: #0056b3; font-size: 0.8em;">(* Harga stlh cashback)</small>`;
                }

                itemListHTML += `
                    <li>
                        <div class="keranjang-item-info">
                            <strong>${produk.NAMA_SKU_PARENT}</strong><br>
                            (${item.qtyKarton} Krt, ${item.qtyBox} Box)
                        </div>
                        <div class="keranjang-item-harga">
                            ${formatRupiah(hargaNettKarton)} / Krt (On Faktur)
                            <button class="detail-item-btn" data-sku="${skuString}">Detail</button>
                            ${hargaAkhirHTML}
                            <small style="display: block; text-decoration: line-through; color: #999; margin-top: 3px;">${formatRupiah(produk.HargaKarton)} / Krt (Bruto)</small>
                        </div>
                    </li>
                `;
            }
        });
        
        itemListHTML += '</ul>';
        
        // Logika Upsell Strata
        let currentPotongan_bppn = 0; 
        const currentTierData = [...dbStrata].reverse().find(tier => qtyGrup >= tier.QTY && tier[eceran] > 0); 
        if (currentTierData) currentPotongan_bppn = currentTierData[eceran]; 
        
        const nextUpsellTierData = dbStrata.find(tier => tier.QTY > qtyGrup && tier[eceran] > currentPotongan_bppn); 
        
        let upsellStrataHTML = ''; 
        if (nextUpsellTierData) { 
            const qtyDibutuhkan = nextUpsellTierData.QTY - qtyGrup; 
            upsellStrataHTML = `<div class="keranjang-upsell-strata">📈 Tambah <strong>${formatAngka(qtyDibutuhkan)} Krt</strong> lagi (total ${nextUpsellTierData.QTY} Krt) untuk dapat potongan ${formatRupiah(nextUpsellTierData[eceran])}/Krt (BPPN).</div>`; 
        } else if (currentPotongan_bppn > 0) { 
            upsellStrataHTML = `<div class="keranjang-upsell-strata tertinggi">🏆 Anda sudah di tier Strata tertinggi.</div>`; 
        } else {
             upsellStrataHTML = `<div class="keranjang-upsell-strata">Tambahkan ${eceran} untuk mendapatkan potongan Strata.</div>`;
        }

        keranjangEl.innerHTML += grupHTML + itemListHTML + upsellStrataHTML;
    }
    
    keranjangEl.querySelectorAll('.detail-item-btn').forEach(btn => { 
        btn.addEventListener('click', showDiscountDetails); 
    });
}

function renderUpsellReguler(totalBrutoPerGrup_belum_ppn) { 
    let recommendations = []; 
    
    for (const grup in totalBrutoPerGrup_belum_ppn) { 
        const brutoGrup_bppn = totalBrutoPerGrup_belum_ppn[grup]; 
        
        let currentTier = null;
        let nextTier = null;

        const currentIndex = dbReguler.findIndex(t => brutoGrup_bppn >= t['NOMINAL FAKTUR'] && t.hasOwnProperty(grup) && t[grup] > 0);
        
        if (currentIndex !== -1) {
            currentTier = dbReguler[currentIndex];
            if (currentIndex > 0) {
                for(let i = currentIndex - 1; i >= 0; i--) {
                    if (dbReguler[i][grup] > currentTier[grup]) {
                        nextTier = dbReguler[i];
                        break;
                    }
                }
            }
        } else if (dbReguler.length > 0) {
            nextTier = dbReguler.find(t => t.hasOwnProperty(grup) && t[grup] > 0);
        }

        if (nextTier) { 
            const rpDibutuhkan_bppn = nextTier['NOMINAL FAKTUR'] - brutoGrup_bppn; 
            const diskonBaru = nextTier[grup] * 100; 

            if (rpDibutuhkan_bppn > 0) {
                recommendations.push(`<li><strong>${grup}:</strong> Tambah Bruto (sblm PPN) <strong>${formatRupiah(rpDibutuhkan_bppn)}</strong> lagi (total ${formatRupiah(nextTier['NOMINAL FAKTUR'])}) untuk dapat diskon ${formatAngka(diskonBaru)}%.</li>`); 
            } else {
                recommendations.push(`<li><strong>${grup}:</strong> 🏆 Anda sudah di tier Reguler tertinggi yang aktif (${formatAngka(diskonBaru)}%).</li>`);
            }
        } 
    } 
    
    if (recommendations.length > 0) 
        upsellRegulerEl.innerHTML = recommendations.join(''); 
    else 
        upsellRegulerEl.innerHTML = '<li>(Tambahkan item untuk melihat rekomendasi)</li>'; 
}


// ==========================================================
// FUNGSI LOGIKA INTI (Sudah Diperbaiki untuk Qty Ganjil)
// ==========================================================
function renderSimulasi() {
    // 1. Hitung Total Bruto & Agregasi
    let subtotalBruto = 0; 
    let totalBrutoPerGrup = {}; 
    let totalKartonPerEceran = {}; 
    let distinctItemsPerEceran = {}; 
    let subtotalBruto_belum_ppn = 0; 
    let totalBrutoPerGrup_belum_ppn = {};
    
    keranjang.forEach((item, skuKey) => { 
        const skuString = String(skuKey); 
        const produk = dbProduk.get(skuString); 
        if (!produk) return; 
        
        const qtyKartonValid = item.qtyKarton || 0; 
        const qtyBoxValid = item.qtyBox || 0; 
        const hargaKartonValid = produk.HargaKarton || 0; 
        const hargaBoxValid = produk.HargaBox || 0; 
        const hargaKarton_bppn = produk.HargaKarton_belum_ppn || 0; 
        const hargaBox_bppn = hargaKarton_bppn / (produk.BOX_PER_CRT || 1); 
        const boxPerCrtValid = produk.BOX_PER_CRT || 1; 
        
        const totalBrutoItem = (qtyKartonValid * hargaKartonValid) + (qtyBoxValid * hargaBoxValid); 
        const totalBrutoItem_bppn = (qtyKartonValid * hargaKarton_bppn) + (qtyBoxValid * hargaBox_bppn); 
        const totalKartonItem = qtyKartonValid + (qtyBoxValid / boxPerCrtValid); 
        
        if (totalKartonItem === 0) return;

        const grupReguler = produk.GROUP; 
        const grupEceran = produk.ECERAN; 
        
        subtotalBruto += totalBrutoItem; 
        subtotalBruto_belum_ppn += totalBrutoItem_bppn; 
        
        totalBrutoPerGrup[grupReguler] = (totalBrutoPerGrup[grupReguler] || 0) + totalBrutoItem; 
        totalBrutoPerGrup_belum_ppn[grupReguler] = (totalBrutoPerGrup_belum_ppn[grupReguler] || 0) + totalBrutoItem_bppn; 
        
        totalKartonPerEceran[grupEceran] = (totalKartonPerEceran[grupEceran] || 0) + totalKartonItem; 
        
        if (!distinctItemsPerEceran[grupEceran]) distinctItemsPerEceran[grupEceran] = new Set(); 
        distinctItemsPerEceran[grupEceran].add(skuString); 
        
        item.diskonDetail = {}; 
    });
    
    subtotalBrutoEl.innerText = formatRupiah(subtotalBruto);
    renderUpsellReguler(totalBrutoPerGrup_belum_ppn);

    // 2. Diskon #1: Reguler
    let totalDiskonReguler = 0; 
    let persenDiskonRegulerPerGrup = {};
    for (const grup in totalBrutoPerGrup_belum_ppn) { 
        const brutoGrup_bppn = totalBrutoPerGrup_belum_ppn[grup]; 
        const brutoGrup_inc_ppn = totalBrutoPerGrup[grup] || 0; 
        persenDiskonRegulerPerGrup[grup] = 0; 
        const tier = dbReguler.find(t => brutoGrup_bppn >= t['NOMINAL FAKTUR'] && t.hasOwnProperty(grup)); 
        if (tier && tier[grup] > 0) { 
            persenDiskonRegulerPerGrup[grup] = tier[grup]; 
            totalDiskonReguler += brutoGrup_inc_ppn * tier[grup]; 
        } 
    }
    diskonRegulerEl.innerText = `- ${formatRupiah(totalDiskonReguler)}`;

    // 3. Diskon #2: Strata (Potongan BPPN)
    let totalPotonganStrata = 0; 
    let potonganStrataPerKarton_bppn = {}; 
    for (const eceran in totalKartonPerEceran) {
        const qtyGrup = totalKartonPerEceran[eceran]; 
        potonganStrataPerKarton_bppn[eceran] = 0; 
        const currentTier = [...dbStrata].reverse().find(tier => qtyGrup >= tier.QTY && tier.hasOwnProperty(eceran) && tier[eceran] > 0);
        if (currentTier) { 
            const potonganPerKarton_bppn = currentTier[eceran]; 
            potonganStrataPerKarton_bppn[eceran] = potonganPerKarton_bppn; 
            totalPotonganStrata += qtyGrup * potonganPerKarton_bppn * PPN_RATE; 
        } 
    }
    diskonStrataEl.innerText = `- ${formatRupiah(totalPotonganStrata)}`; 

    // 4. Diskon #3: Tambahan (Potongan BPPN)
    let totalPotonganTambahan = 0; 
    let potonganTambahanPerKarton_bppn = {}; 
    promoTambahanMap.forEach(promo => { 
        const grupPromo = promo.GROUP; 
        const qtyMin = promo.QTY; 
        const itemMin = promo.ITEM; 
        const potongan_bppn = promo.POT; 
        const qtyGroupActual = totalKartonPerEceran[grupPromo] || 0; 
        const distinctItemsInGroup = distinctItemsPerEceran[grupPromo]?.size || 0; 
        
        if (qtyGroupActual >= qtyMin && distinctItemsInGroup >= itemMin && potongan_bppn > 0) { 
            potonganTambahanPerKarton_bppn[grupPromo] = (potonganTambahanPerKarton_bppn[grupPromo] || 0) + potongan_bppn; 
            totalPotonganTambahan += qtyGroupActual * potongan_bppn * PPN_RATE; 
        } 
    }); 
    diskonTambahanEl.innerText = `- ${formatRupiah(totalPotonganTambahan)}`; 

    // 5. Total Faktur (Inc PPN, sebelum COD)
    const totalFaktur = subtotalBruto - totalDiskonReguler - totalPotonganStrata - totalPotonganTambahan; 
    totalFakturEl.innerText = formatRupiah(totalFaktur);

    // 6. Diskon #4: COD
    let totalDiskonCOD = 0; 
    let persenCOD = 0; 
    const tierCOD = dbCOD.find(t => subtotalBruto_belum_ppn >= t['NOMINAL FAKTUR'] && t.COD > 0); 
    if (tierCOD) { 
        persenCOD = tierCOD.COD; 
        totalDiskonCOD = totalFaktur * persenCOD; 
    } 
    diskonCODEl.innerText = `- ${formatRupiah(totalDiskonCOD)}`;

    // 7. Total Nett On-Faktur (setelah COD)
    const totalNettOnFaktur = totalFaktur - totalDiskonCOD;
    totalNettOnFakturEl.innerText = formatRupiah(totalNettOnFaktur);
    
    // 8. Potongan Voucher
    const potonganVoucher = parseFloat(inputVoucherEl.value) || 0;
    potonganVoucherEl.innerText = `- ${formatRupiah(potonganVoucher)}`;

    // 9. Loyalti
    let persenLoyalti = 0; 
    const kelasLoyalti = kelasPelangganEl.value; 
    const tierLoyalti = dbLoyalti.find(t => t.KELAS === kelasLoyalti); 
    if (tierLoyalti) { persenLoyalti = tierLoyalti.REWARD; }

    // 10. Hitung Detail Diskon per Item (Perbaikan Qty Ganjil)
    keranjang.forEach(item => {
        const produk = dbProduk.get(String(item.sku)); 
        if (!produk) return;
        
        const grupReguler = produk.GROUP; 
        const grupEceran = produk.ECERAN;
        
        const qtyKartonValid = item.qtyKarton || 0; 
        const qtyBoxValid = item.qtyBox || 0; 
        const hargaKartonValid = produk.HargaKarton || 0;
        const boxPerCrtValid = produk.BOX_PER_CRT || 1;
        
        const totalKartonItem = qtyKartonValid + (qtyBoxValid / boxPerCrtValid); 
        const totalBrutoItem_inc_ppn = (qtyKartonValid * hargaKartonValid) + (qtyBoxValid * produk.HargaBox || 0); 
        
        if (totalKartonItem === 0) return;

        // Diskon Reguler (Persentase dari Harga Bruto Item)
        const persenReguler = persenDiskonRegulerPerGrup[grupReguler] || 0;
        const totalDiskonRegulerItem_inc_ppn = totalBrutoItem_inc_ppn * persenReguler;
        const diskonRegulerPerKarton = (totalDiskonRegulerItem_inc_ppn / totalKartonItem); // Nilai diskon rata-rata per karton

        // Potongan Strata (Nilai Absolut BPPN per Karton)
        const potonganStrataItem_bppn = potonganStrataPerKarton_bppn[grupEceran] || 0;
        const potonganStrataItem_inc_ppn = potonganStrataItem_bppn * PPN_RATE;

        // Potongan Tambahan (Nilai Absolut BPPN per Karton)
        const potonganTambahanItem_bppn = potonganTambahanPerKarton_bppn[grupEceran] || 0;
        const potonganTambahanItem_inc_ppn = potonganTambahanItem_bppn * PPN_RATE;
        
        // Harga Nett per Karton (Sebelum COD)
        const hargaSetelahDiskonPerKarton = produk.HargaKarton - diskonRegulerPerKarton - potonganStrataItem_inc_ppn - potonganTambahanItem_inc_ppn;
        
        // Diskon COD (Persentase dari Harga Nett Sebelum COD)
        const diskonCODPerKarton = hargaSetelahDiskonPerKarton * persenCOD;
        
        // Harga Nett On-Faktur per Karton (Setelah COD)
        const hargaNettKartonItem_inc_ppn = hargaSetelahDiskonPerKarton - diskonCODPerKarton;

        // Cashback Loyalti
        const diskonLoyaltiPerKarton = produk.ITEM_LOYALTI === 'Y' ? hargaNettKartonItem_inc_ppn * persenLoyalti : 0;
        const hargaNettAkhirKartonItem = hargaNettKartonItem_inc_ppn - diskonLoyaltiPerKarton;

        item.diskonDetail = {
            regulerPerKarton: diskonRegulerPerKarton, 
            strataPerKarton_bppn: potonganStrataItem_bppn,
            tambahanPerKarton_bppn: potonganTambahanItem_bppn,
            codPerKarton: diskonCODPerKarton,
            hargaNettKarton: hargaNettKartonItem_inc_ppn, 
            loyaltiPerKarton: diskonLoyaltiPerKarton, 
            hargaNettAkhirKarton: hargaNettAkhirKartonItem 
        };
    });

    // 11. Hitung Sisa Tagihan Akhir & Update Tampilan
    const sisaTagihan = totalNettOnFaktur - potonganVoucher;
    sisaTagihanEl.innerText = formatRupiah(sisaTagihan);
    summaryBarTotalEl.innerText = formatRupiah(sisaTagihan);
    renderKeranjang(totalKartonPerEceran);
}

// Panggil init saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', init);










