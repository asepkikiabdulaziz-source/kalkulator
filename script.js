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
const summaryBarTotalEl = document.getElementById('summary-bar-total'); // Untuk update harga di bar
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


// --- Fungsi Helper ---
function formatRupiah(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0); }
function formatAngka(angka) { return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(angka || 0); }
async function fetchSheetData(gid) { 
    const url = `${GOOGLE_SHEET_URL}&gid=${gid}&single=true&output=csv`; 
    return new Promise((resolve, reject) => { 
        // Pastikan Papa.parse tersedia (Anda mungkin perlu menyertakan library PapaParse di HTML Anda)
        if (typeof Papa === 'undefined') {
            console.error("PapaParse library is not loaded.");
            reject(new Error("PapaParse library is not loaded."));
            return;
        }
        Papa.parse(url, { 
            download: true, 
            header: true, 
            dynamicTyping: true, 
            skipEmptyLines: true, 
            complete: (results) => { 
                console.log(`Data GID ${gid} berhasil dimuat.`); 
                resolve(results.data); 
            }, 
            error: (err) => { 
                console.error(`Gagal memuat GID ${gid}:`, err); 
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
    }).sort((a, b) => a.QTY - b.QTY); 
}
function cleanTierData(data, key) { 
    // Sort descending based on 'NOMINAL FAKTUR' (key) to easily find the highest tier met
    return data.map(row => ({ ...row })).sort((a, b) => b[key] - a[key]); 
}
function toggleSummaryPanel() { 
    summaryPanelEl.classList.toggle('summary-visible'); 
    const isVisible = summaryPanelEl.classList.contains('summary-visible'); 
    document.body.style.overflow = isVisible ? 'hidden' : 'auto'; 
}


// --- Fungsi Inisialisasi ---
async function init() {
    try {
        // Asumsi PapaParse sudah dimuat di file HTML
        const [ produkData, regData, strataData, tamData, codData, loyData ] = await Promise.all([ 
            fetchSheetData(GID_PRODUK), 
            fetchSheetData(GID_REGULER), 
            fetchSheetData(GID_STRATA), 
            fetchSheetData(GID_TAMBAHAN), 
            fetchSheetData(GID_COD), 
            fetchSheetData(GID_LOYALTI) 
        ]);

        // Inisialisasi dbProduk Map
        dbProduk.clear(); 
        produkData.forEach(p => { 
            const hargaKarton = p['HARGA (INC PPN)']; 
            const boxPerKrt = p.BOX_PER_CRT || 1; 
            const pcsPerBox = p.PCS_PER_BOX || 1; 
            
            // Konversi nilai yang mungkin berupa string
            p.BOX_PER_CRT = parseInt(p.BOX_PER_CRT) || 1; 
            p.PCS_PER_BOX = parseInt(p.PCS_PER_BOX) || 1; 
            p['HARGA (INC PPN)'] = parseFloat(p['HARGA (INC PPN)']) || 0;

            p.HargaKarton = hargaKarton; 
            p.HargaKarton_belum_ppn = hargaKarton / PPN_RATE; 
            p.HargaBox = hargaKarton / boxPerKrt; 
            p.HargaPcs = p.HargaBox / pcsPerBox; 
            
            // Pastikan KD_SKU_PARENT valid
            if (p.KD_SKU_PARENT !== null && p.KD_SKU_PARENT !== undefined) { 
                const skuString = String(p.KD_SKU_PARENT); 
                dbProduk.set(skuString, p); 
            } else { 
                console.warn("Ditemukan produk tanpa KD_SKU_PARENT:", p); 
            } 
        }); 
        console.log(`dbProduk Map dibuat dengan ${dbProduk.size} entri.`);

        // Inisialisasi Database Lain
        dbReguler = cleanTierData(regData, 'NOMINAL FAKTUR'); 
        dbCOD = cleanTierData(codData, 'NOMINAL FAKTUR'); 
        dbTambahan = tamData; 
        promoTambahanMap.clear(); 
        dbTambahan.forEach(promo => { 
            if (promo.GROUP) { 
                // Pastikan QTY, ITEM, POT adalah angka
                promo.QTY = parseInt(promo.QTY) || 0;
                promo.ITEM = parseInt(promo.ITEM) || 0;
                promo.POT = parseFloat(promo.POT) || 0;
                promoTambahanMap.set(promo.GROUP, promo); 
            } 
        }); 
        dbLoyalti = loyData; 
        dbStrata = cleanStrataData(strataData);

        // Membangun Tampilan
        buildMenu(); 
        buildDropdowns();

        // Menyembunyikan Loading dan Menampilkan Kontainer
        loadingEl.style.display = 'none'; 
        containerEl.style.display = 'flex';

        // Menambahkan Event Listeners
        kelasPelangganEl.addEventListener('change', renderSimulasi); 
        inputVoucherEl.addEventListener('input', renderSimulasi); 
        closeModalBtn.addEventListener('click', () => modalEl.style.display = 'none'); 
        window.addEventListener('click', (event) => { if (event.target == modalEl) { modalEl.style.display = 'none'; } }); 
        btnResetEl.addEventListener('click', resetAplikasi);
        summaryToggleBarEl.addEventListener('click', toggleSummaryPanel); // Listener Bilah Bawah
        closeSummaryBtn.addEventListener('click', toggleSummaryPanel); 
        searchInputEl.addEventListener('input', filterMenu);

        // Panggil renderSimulasi awal
        renderSimulasi();

    } catch (error) { 
        loadingEl.innerText = `Gagal memuat data. Periksa GID, URL Google Sheet, atau koneksi internet. Error: ${error.message}`; 
        console.error("Kesalahan Inisialisasi:", error); 
    }
}

// --- Fungsi Membangun Tampilan (Menu) ---
function buildMenu() { 
    const groupedProduk = {}; 
    dbProduk.forEach(p => { 
        const group = p.ECERAN || 'LAIN-LAIN'; 
        if (!groupedProduk[group]) groupedProduk[group] = []; 
        groupedProduk[group].push(p); 
    }); 
    
    menuContainerEl.innerHTML = ''; 
    const displayedGroups = new Set(); 
    let finalGroupOrder = []; 
    
    // Prioritaskan CUSTOM_GROUP_ORDER
    CUSTOM_GROUP_ORDER.forEach(groupName => { 
        if (groupedProduk[groupName]) { 
            finalGroupOrder.push(groupName); 
            displayedGroups.add(groupName); 
        } 
    }); 
    
    // Tambahkan grup lain yang tersisa (diurutkan)
    Object.keys(groupedProduk).sort().forEach(groupName => { 
        if (!displayedGroups.has(groupName)) finalGroupOrder.push(groupName); 
    }); 
    
    console.log("Urutan Grup Menu:", finalGroupOrder); 
    
    for (const groupName of finalGroupOrder) { 
        const items = groupedProduk[groupName]; 
        let itemHTML = ''; 
        items.forEach(p => { 
            // Pastikan input quantity sudah diisi jika ada di keranjang
            const keranjangItem = keranjang.get(String(p.KD_SKU_PARENT));
            const qtyKrt = keranjangItem ? keranjangItem.qtyKarton : '';
            const qtyBox = keranjangItem ? keranjangItem.qtyBox : '';

            itemHTML += `
                <div class="kartu-produk" data-sku="${String(p.KD_SKU_PARENT)}">
                    <div>
                        <div class="nama-item">${p.NAMA_SKU_PARENT}</div>
                        <div class="harga-item">${formatRupiah(p.HargaKarton)}/Krt | ${p.BOX_PER_CRT} Box/Krt | ${p.PCS_PER_BOX} Pcs/Box</div>
                    </div>
                    <div class="input-qty">
                        <input type="number" min="0" placeholder="Krt" class="input-krt" data-sku="${String(p.KD_SKU_PARENT)}" value="${qtyKrt}">
                        <input type="number" min="0" placeholder="Box" class="input-box" data-sku="${String(p.KD_SKU_PARENT)}" value="${qtyBox}">
                    </div>
                </div>
            `; 
        }); 
        
        const promoInfo = promoTambahanMap.get(groupName); 
        let promoTambahanBtnHTML = ''; 
        if (promoInfo && promoInfo.POT > 0) promoTambahanBtnHTML = `<button class="promo-tambahan-btn" data-group="${groupName}">🎁 Info Promo Tambahan</button>`; 
        
        const hasStrataPromo = dbStrata.length > 0 && dbStrata[0].hasOwnProperty(groupName) && dbStrata.some(tier => tier[groupName] > 0); 
        let strataInfoBtnHTML = ''; 
        if (hasStrataPromo) strataInfoBtnHTML = `<button class="strata-info-btn" data-stratagroup="${groupName}">Info Strata</button>`; 
        
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
    
    // Re-attach listeners ke input dan tombol yang baru dibuat
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
        if (productName.includes(searchTerm)) 
            card.classList.remove('hidden'); 
        else 
            card.classList.add('hidden'); 
    }); 
    
    groupSections.forEach(group => { 
        const visibleItemsInGroup = group.querySelectorAll('.kartu-produk:not(.hidden)'); 
        // Grup tersembunyi jika semua produk di dalamnya tersembunyi
        if (visibleItemsInGroup.length === 0) 
            group.classList.add('hidden'); 
        else 
            group.classList.remove('hidden'); 
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
    
    if (dbStrata.length > 0 && dbStrata[0].hasOwnProperty(strataGroup)) { 
        dbStrata.forEach(tier => { 
            const currentPotongan = tier[strataGroup] || 0; // Nilai POTONGAN di sheet Strata adalah BPPN
            if (currentPotongan > 0 && currentPotongan > lastShownPotongan) { 
                infoText += `${tier.QTY} Krt      | ${formatRupiah(currentPotongan)}\n`; 
                lastShownPotongan = currentPotongan; 
            } 
        }); 
        if (lastShownPotongan < 0) infoText += "(Tidak ada potongan aktif untuk grup ini)\n"; 
    } else { 
        infoText = `Tidak ada aturan strata yang ditemukan untuk grup ${strataGroup}.`; 
    } 
    
    modalTitleEl.innerText = `Info Strata (${strataGroup})`; 
    modalContentEl.innerText = infoText; 
    modalEl.style.display = 'block'; 
}

function showPromoTambahanInfo(event) { 
    const groupName = event.target.dataset.group; 
    const promoInfo = promoTambahanMap.get(groupName); 
    let infoText = ""; 
    
    if (promoInfo) { 
        infoText += `Deskripsi    : Promo ${promoInfo.GROUP}\n`;
        infoText += `Minimal Qty  : ${promoInfo.QTY} Karton\n`;
        infoText += `Minimal Item : ${promoInfo.ITEM} item berbeda\n`;
        infoText += `Potongan     : ${formatRupiah(promoInfo.POT)} / Karton (Nilai Potongan ini adalah sebelum PPN)\n`;
    } else { 
        infoText = `Tidak ada promo tambahan untuk grup ${groupName}.`; 
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
    // Membangun ulang menu untuk memastikan nilai input di-reset
    // buildMenu(); 
    
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
    // Menggunakan parseFloat karena input type="number" bisa kosong/string
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

// --- FUNGSI DETAIL DISKON (Pop-up) ---
function showDiscountDetails(event) {
    const sku = String(event.target.dataset.sku); 
    const keranjangItem = keranjang.get(sku); 
    const produk = dbProduk.get(sku); 
    
    if (!keranjangItem || !produk) { 
        alert("Gagal mendapatkan detail item."); 
        return; 
    }
    
    const detail = keranjangItem.diskonDetail || {};
    
    // Potongan Strata & Tambahan di detail adalah basis BPPN
    const potonganStrataItem_inc_ppn = detail.strataPerKarton_bppn * PPN_RATE;
    const potonganTambahanItem_inc_ppn = detail.tambahanPerKarton_bppn * PPN_RATE;

    // Perhitungan ulang untuk tampilan Pop-up
    const hargaSebelumCOD = produk.HargaKarton - (detail.regulerPerKarton || 0) - potonganStrataItem_inc_ppn - potonganTambahanItem_inc_ppn;
    
    let infoText = `Rincian Harga Nett per Karton untuk:\n${produk.NAMA_SKU_PARENT}\n--------------------------------------\n`;
    infoText += `Harga Awal (Inc PPN) : ${formatRupiah(produk.HargaKarton)}\n`;
    infoText += `- Diskon Reguler     : ${formatRupiah(detail.regulerPerKarton || 0)}\n`; // Ini Inc PPN (Persen * Harga Awal)
    
    // Menampilkan potongan SEBELUM PPN, tapi totalnya dihitung Inc PPN
    infoText += `- Potongan Strata    : ${formatRupiah(detail.strataPerKarton_bppn || 0)} (BPPN)\n`;
    infoText += `- Potongan Tambahan  : ${formatRupiah(detail.tambahanPerKarton_bppn || 0)} (BPPN)\n`;
    
    infoText += `--------------------------------------\nSubtotal (Inc PPN)   : ${formatRupiah(hargaSebelumCOD)}\n`;
    infoText += `- Diskon COD         : ${formatRupiah(detail.codPerKarton || 0)}\n`; // Ini Inc PPN
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


// --- FUNGSI KERANJANG & UPSELL STRATA ---
function renderKeranjang(totalKartonPerEceran) {
    if (keranjang.size === 0) { 
        keranjangEl.innerHTML = '<p>(Keranjang kosong)</p>'; 
        return; 
    }
    
    keranjangEl.innerHTML = '';
    
    // Urutkan keranjang berdasarkan CUSTOM_GROUP_ORDER
    const keranjangGroupOrder = Object.keys(totalKartonPerEceran).sort((a,b) => (CUSTOM_GROUP_ORDER.indexOf(a) === -1 ? Infinity : CUSTOM_GROUP_ORDER.indexOf(a)) - (CUSTOM_GROUP_ORDER.indexOf(b) === -1 ? Infinity : CUSTOM_GROUP_ORDER.indexOf(b)));
    
    for (const eceran of keranjangGroupOrder) {
        const qtyGrup = totalKartonPerEceran[eceran];
        let grupHTML = `<div class="keranjang-grup-header">${eceran} (Total ${formatAngka(qtyGrup)} Krt)</div>`;
        let itemListHTML = '<ul class="keranjang-item-list">';
        
        // Filter item keranjang yang termasuk dalam grup eceran ini
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
                let hargaNettAkhirKarton = hargaNettKarton;

                if (produk.ITEM_LOYALTI === 'Y') {
                    hargaNettAkhirKarton = item.diskonDetail?.hargaNettAkhirKarton || hargaNettKarton;
                    hargaAkhirHTML = `<span style="color: #0056b3; font-weight: bold; margin-left: 5px;">* ${formatRupiah(hargaNettAkhirKarton)} / Krt</span><small style="display: block; color: #0056b3; font-size: 0.8em;">(* Harga stlh cashback)</small>`;
                }

                // Tampilkan Harga Nett On-Faktur (setelah COD)
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
    
    // Attach listener ke tombol Detail yang baru dibuat
    keranjangEl.querySelectorAll('.detail-item-btn').forEach(btn => { 
        btn.addEventListener('click', showDiscountDetails); 
    });
}

// --- FUNGSI UPSELL REGULER ---
function renderUpsellReguler(totalBrutoPerGrup_belum_ppn) { 
    let recommendations = []; 
    
    // dbReguler sudah diurutkan menurun berdasarkan NOMINAL FAKTUR
    for (const grup in totalBrutoPerGrup_belum_ppn) { 
        const brutoGrup_bppn = totalBrutoPerGrup_belum_ppn[grup]; 
        
        let currentTier = null;
        let nextTier = null;

        // Cari tier yang saat ini terpenuhi
        const currentIndex = dbReguler.findIndex(t => brutoGrup_bppn >= t['NOMINAL FAKTUR'] && t.hasOwnProperty(grup) && t[grup] > 0);
        
        if (currentIndex !== -1) {
            currentTier = dbReguler[currentIndex];
            // Cek apakah ada tier yang lebih tinggi (indeks lebih kecil)
            if (currentIndex > 0) {
                 // Cari tier di atasnya yang memberikan diskon lebih besar
                for(let i = currentIndex - 1; i >= 0; i--) {
                    if (dbReguler[i][grup] > currentTier[grup]) {
                        nextTier = dbReguler[i];
                        break;
                    }
                }
            }
        } else if (dbReguler.length > 0) {
            // Jika tidak ada tier yang terpenuhi, cari tier pertama yang memiliki diskon
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
// FUNGSI LOGIKA INTI (Perbaikan di Langkah 10b)
// ==========================================================
function renderSimulasi() {
    // ... (Langkah 1-9: Agregasi dan Perhitungan Total Faktur/Voucher sudah benar)

    // 10a. Dapatkan persen Loyalti dulu
    let persenLoyalti = 0; 
    const kelasLoyalti = kelasPelangganEl.value; 
    const tierLoyalti = dbLoyalti.find(t => t.KELAS === kelasLoyalti); 
    if (tierLoyalti) { 
        persenLoyalti = tierLoyalti.REWARD; 
    }

    // 10b. Hitung & Simpan Detail Diskon per Item (PERBAIKAN FOKUS)
    keranjang.forEach(item => {
        const skuString = String(item.sku); 
        const produk = dbProduk.get(skuString); 
        if (!produk) return;
        
        const grupReguler = produk.GROUP; 
        const grupEceran = produk.ECERAN;
        
        // 10b.1. Hitung total kuantitas dan harga bruto item
        const qtyKartonValid = !isNaN(item.qtyKarton) ? item.qtyKarton : 0; 
        const qtyBoxValid = !isNaN(item.qtyBox) ? item.qtyBox : 0; 
        const hargaKartonValid = produk.HargaKarton || 0; 
        const hargaBoxValid = produk.HargaBox || 0; 
        const boxPerCrtValid = (produk.BOX_PER_CRT && produk.BOX_PER_CRT !== 0) ? produk.BOX_PER_CRT : 1;
        
        const totalKartonItem = qtyKartonValid + (qtyBoxValid / boxPerCrtValid); // Total Karton (desimal)
        const totalBrutoItem_inc_ppn = (qtyKartonValid * hargaKartonValid) + (qtyBoxValid * hargaBoxValid); // Total Bruto (Inc PPN)
        
        if (totalKartonItem === 0) return; // Lindungi dari pembagian nol

        // 10b.2. Dapatkan Nilai Diskon/Potongan per Karton (Inc PPN)
        // Diskon Reguler (Persentase dari Harga Bruto)
        const persenReguler = persenDiskonRegulerPerGrup[grupReguler] || 0;
        const totalDiskonRegulerItem_inc_ppn = totalBrutoItem_inc_ppn * persenReguler;
        const diskonRegulerPerKarton = (totalDiskonRegulerItem_inc_ppn / totalKartonItem);

        // Potongan Strata (Nilai Absolut BPPN per Karton, dikonversi ke Inc PPN)
        const potonganStrataItem_bppn = potonganStrataPerKarton_bppn[grupEceran] || 0;
        const potonganStrataItem_inc_ppn = potonganStrataItem_bppn * PPN_RATE;

        // Potongan Tambahan (Nilai Absolut BPPN per Karton, dikonversi ke Inc PPN)
        const potonganTambahanItem_bppn = potonganTambahanPerKarton_bppn[grupEceran] || 0;
        const potonganTambahanItem_inc_ppn = potonganTambahanItem_bppn * PPN_RATE;
        
        // 10b.3. Hitung Harga Nett per Karton (Sebelum COD)
        const hargaSetelahDiskonPerKarton = produk.HargaKarton - diskonRegulerPerKarton - potonganStrataItem_inc_ppn - potonganTambahanItem_inc_ppn;
        
        // 10b.4. Diskon COD (Persentase dari Harga Nett Sebelum COD)
        const diskonCODPerKarton = hargaSetelahDiskonPerKarton * persenCOD;
        
        // 10b.5. Harga Nett On-Faktur per Karton (Setelah COD)
        const hargaNettKartonItem_inc_ppn = hargaSetelahDiskonPerKarton - diskonCODPerKarton;

        // 10b.6. Cashback Loyalti
        const diskonLoyaltiPerKarton = produk.ITEM_LOYALTI === 'Y' ? hargaNettKartonItem_inc_ppn * persenLoyalti : 0;
        const hargaNettAkhirKartonItem = hargaNettKartonItem_inc_ppn - diskonLoyaltiPerKarton;

        // Simpan detail (per KARTON)
        item.diskonDetail = {
            // Kita simpan diskon/potongan per karton
            regulerPerKarton: diskonRegulerPerKarton, 
            strataPerKarton_bppn: potonganStrataItem_bppn,
            tambahanPerKarton_bppn: potonganTambahanItem_bppn,
            codPerKarton: diskonCODPerKarton,
            hargaNettKarton: hargaNettKartonItem_inc_ppn, // Harga Nett On-Faktur per Karton
            loyaltiPerKarton: diskonLoyaltiPerKarton, 
            hargaNettAkhirKarton: hargaNettAkhirKartonItem // Harga Nett Akhir per Karton
        };
    });

    // ... (Langkah 11-13: Perhitungan akhir dan render sudah benar)


    // 11. Hitung Sisa Tagihan Akhir
    const sisaTagihan = totalNettOnFaktur - potonganVoucher;
    sisaTagihanEl.innerText = formatRupiah(sisaTagihan);

    // 12. Update Total di Bilah Bawah (Summary Toggle Bar)
    summaryBarTotalEl.innerText = formatRupiah(sisaTagihan);

    // 13. Render Tampilan Keranjang
    renderKeranjang(totalKartonPerEceran);


// Panggil init saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', init);










