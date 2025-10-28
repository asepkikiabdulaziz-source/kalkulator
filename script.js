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
const keranjangEl = document.getElementById('daftarKeranjang'); // <div> untuk grup keranjang
const kelasPelangganEl = document.getElementById('kelasPelanggan');
const inputVoucherEl = document.getElementById('inputVoucher');
const upsellRegulerEl = document.getElementById('daftarUpsellReguler'); // <ul> untuk upsell reguler
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
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(angka);
}
function formatAngka(angka) {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(angka);
}

// Fungsi untuk mengambil dan mem-parse CSV dari Google Sheet
async function fetchSheetData(gid) {
    const url = `${GOOGLE_SHEET_URL}&gid=${gid}&single=true&output=csv`;
    return new Promise((resolve, reject) => {
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

// Fungsi untuk membersihkan data (penting untuk Strata)
function cleanStrataData(data) {
    // Cari tahu kolom mana yang merupakan grup strata (selain 'QTY')
    const strataGroups = Object.keys(data[0]).filter(k => k.toUpperCase() !== 'QTY');
    
    return data.map(row => {
        // Bersihkan QTY
        if (typeof row.QTY === 'string') {
            row.QTY = parseInt(row.QTY.replace(/[^0-9]/g, '')) || 0;
        }

        // Bersihkan kolom strata
        for (const group of strataGroups) {
            let val = row[group];
            if (typeof val === 'string') {
                row[group] = parseInt(val.replace(/[^0-9]/g, '')) || 0;
            } else if (val === null || val === undefined) {
                row[group] = 0;
            }
        }
        return row;
    }).sort((a, b) => a.QTY - b.QTY); // Urutkan dari QTY terkecil (PENTING untuk upsell)
}

function cleanTierData(data, key) {
    // Membersihkan dan mengurutkan data tier (Reguler, COD)
    return data
        .map(row => ({ ...row })) // Salin data
        .sort((a, b) => b[key] - a[key]); // Urutkan dari NOMINAL FAKTUR terbesar
}

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
        produkData.forEach(p => {
            const hargaKarton = p['HARGA (INC PPN)'];
            const boxPerKrt = p.BOX_PER_CRT || 1;
            const pcsPerBox = p.PCS_PER_BOX || 1;
            
            p.HargaKarton = hargaKarton;
            p.HargaBox = hargaKarton / boxPerKrt;
            p.HargaPcs = p.HargaBox / pcsPerBox; 
            dbProduk.set(p.KD_SKU_PARENT, p);
        });

        // 2. Proses Aturan Diskon
        dbReguler = cleanTierData(regData, 'NOMINAL FAKTUR');
        dbCOD = cleanTierData(codData, 'NOMINAL FAKTUR');
        dbTambahan = tamData; 
        
        promoTambahanMap.clear();
        dbTambahan.forEach(promo => {
            if (promo.GROUP) {
                promoTambahanMap.set(promo.GROUP, promo); 
            }
        });
        
        dbLoyalti = loyData; 
        dbStrata = cleanStrataData(strataData); // Diurutkan Ascending

        // 3. Bangun Tampilan
        buildMenu();
        buildDropdowns();

        // 4. Tampilkan aplikasi
        loadingEl.style.display = 'none';
        containerEl.style.display = 'flex';

        // 5. Tambah Listener
        kelasPelangganEl.addEventListener('change', renderSimulasi);
        inputVoucherEl.addEventListener('input', renderSimulasi);
        closeModalBtn.addEventListener('click', () => modalEl.style.display = 'none');
        window.addEventListener('click', (event) => {
            if (event.target == modalEl) {
                modalEl.style.display = 'none';
            }
        });

    } catch (error) {
        loadingEl.innerText = `Gagal memuat data. Periksa GID atau URL Google Sheet. Error: ${error.message}`;
        console.error("Kesalahan Inisialisasi:", error);
    }
}

// --- Fungsi Membangun Tampilan (Menu) ---
function buildMenu() {
    const groupedProduk = {};
    dbProduk.forEach(p => {
        const group = p.ECERAN || 'LAIN-LAIN';
        if (!groupedProduk[group]) {
            groupedProduk[group] = [];
        }
        groupedProduk[group].push(p);
    });
    menuContainerEl.innerHTML = '';
    const sortedGroupNames = Object.keys(groupedProduk).sort();

    for (const groupName of sortedGroupNames) {
        const items = groupedProduk[groupName];
        let itemHTML = '';
        
        items.forEach(p => {
            itemHTML += `
                <div class="kartu-produk" data-sku="${p.KD_SKU_PARENT}">
                    <div>
                        <div class="nama-item">${p.NAMA_SKU_PARENT}</div>
                        <div class="harga-item">
                            ${formatRupiah(p.HargaKarton)}/Krt | 
                            ${p.BOX_PER_CRT} Box/Krt | 
                            ${p.PCS_PER_BOX} Pcs/Box
                        </div>
                    </div>
                    <div class="input-qty">
                        <input type="number" min="0" placeholder="Krt" class="input-krt" data-sku="${p.KD_SKU_PARENT}">
                        <input type="number" min="0" placeholder="Box" class="input-box" data-sku="${p.KD_SKU_PARENT}">
                    </div>
                </div>
            `;
        });

        const promoInfo = promoTambahanMap.get(groupName);
        let promoTambahanBtnHTML = ''; 
        if (promoInfo) {
            promoTambahanBtnHTML = `
                <button class="promo-tambahan-btn" data-group="${groupName}">
                    🎁 Info Promo Tambahan
                </button>
            `;
        }

        const groupHTML = `
            <div class="grup-produk">
                <div class="grup-header">
                    <h3>Grup Strata: ${groupName}</h3>
                    <div class="grup-header-tombol">
                        ${promoTambahanBtnHTML}
                        <button class="strata-info-btn" data-stratagroup="${groupName}">
                            Info Strata (${groupName})
                        </button>
                    </div>
                </div>
                ${itemHTML}
            </div>
        `;
        menuContainerEl.innerHTML += groupHTML;
    }

    menuContainerEl.querySelectorAll('.input-krt, .input-box').forEach(input => {
        input.addEventListener('input', updateKeranjang);
    });
    menuContainerEl.querySelectorAll('.strata-info-btn').forEach(btn => {
        btn.addEventListener('click', showStrataInfo);
    });
    menuContainerEl.querySelectorAll('.promo-tambahan-btn').forEach(btn => {
        btn.addEventListener('click', showPromoTambahanInfo);
    });
}
function buildDropdowns() {
    kelasPelangganEl.innerHTML = '<option value="">- Pilih Kelas -</option>';
    dbLoyalti.forEach(item => {
        kelasPelangganEl.innerHTML += `
            <option value="${item.KELAS}">${item.KELAS} (${item.REWARD * 100}%)</option>
        `;
    });
}
function showStrataInfo(event) {
    const strataGroup = event.target.dataset.stratagroup;
    let infoText = `QTY Karton | Potongan/Karton\n`;
    infoText += `----------------------------\n`;
    if (dbStrata.length > 0 && dbStrata[0].hasOwnProperty(strataGroup)) {
        // (dbStrata diurutkan ascending)
        dbStrata.forEach(tier => {
            if (tier[strataGroup] > 0) {
                infoText += `${tier.QTY} Krt      | ${formatRupiah(tier[strataGroup])}\n`;
            }
        });
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
        infoText += `Deskripsi: Promo ${promoInfo.GROUP}\n`;
        infoText += `Minimal Qty: ${promoInfo.QTY} Karton\n`;
        infoText += `Potongan: ${formatRupiah(promoInfo.POT)} / Karton\n`;
    } else {
        infoText = `Tidak ada promo tambahan untuk grup ${groupName}.`;
    }
    modalTitleEl.innerText = `Info Promo Tambahan (${groupName})`;
    modalContentEl.innerText = infoText;
    modalEl.style.display = 'block';
}


// --- Fungsi Update & Render ---
function updateKeranjang(event) {
    const sku = event.target.dataset.sku;
    const isKarton = event.target.classList.contains('input-krt');
    const value = parseInt(event.target.value) || 0;
    let item = keranjang.get(sku) || { sku: sku, qtyKarton: 0, qtyBox: 0 };
    if (isKarton) {
        item.qtyKarton = value;
    } else {
        item.qtyBox = value;
    }
    if (item.qtyKarton > 0 || item.qtyBox > 0) {
        keranjang.set(sku, item);
    } else {
        keranjang.delete(sku); 
    }
    renderSimulasi();
}

// --- FUNGSI KERANJANG & UPSELL STRATA (DITULIS ULANG) ---
function renderKeranjang(totalKartonPerEceran) {
    if (keranjang.size === 0) {
        keranjangEl.innerHTML = '<p>(Keranjang kosong)</p>';
        return;
    }

    keranjangEl.innerHTML = ''; // Kosongkan
    
    // Iterasi per GRUP ECERAN yang ada di keranjang
    for (const eceran in totalKartonPerEceran) {
        const qtyGrup = totalKartonPerEceran[eceran];
        let grupHTML = '';
        let itemListHTML = '';

        // Header Grup
        grupHTML += `<div class="keranjang-grup-header">${eceran} (Total ${formatAngka(qtyGrup)} Krt)</div>`;
        
        // Daftar item
        itemListHTML += '<ul class="keranjang-item-list">';
        keranjang.forEach(item => {
            const produk = dbProduk.get(item.sku);
            if (produk && produk.ECERAN === eceran) {
                const totalBrutoItem = (item.qtyKarton * produk.HargaKarton) + (item.qtyBox * produk.HargaBox);
                itemListHTML += `
                    <li>
                        <span>
                            <strong>${produk.NAMA_SKU_PARENT}</strong><br>
                            (${item.qtyKarton} Krt, ${item.qtyBox} Box)
                        </span>
                        <span>${formatRupiah(totalBrutoItem)}</span>
                    </li>
                `;
            }
        });
        itemListHTML += '</ul>';

        // --- LOGIKA UPSELL STRATA (CERDAS) ---
        
        // 1. Cari potongan SAAT INI
        let currentPotongan = 0;
        const currentTier = [...dbStrata].reverse().find(tier => 
            qtyGrup >= tier.QTY && tier[eceran] > 0
        );
        if (currentTier) {
            currentPotongan = currentTier[eceran];
        }

        // 2. Cari tier BERIKUTNYA yang potongannya LEBIH BESAR
        // (dbStrata sudah diurutkan ascending)
        const nextUpsellTier = dbStrata.find(tier => 
            tier.QTY > qtyGrup &&           // QTY harus lebih besar
            tier[eceran] > currentPotongan // Potongan harus LEBIH TINGGI
        );
        
        let upsellStrataHTML = '';
        if (nextUpsellTier) {
            // Jika ditemukan tier yang lebih baik
            const qtyDibutuhkan = nextUpsellTier.QTY - qtyGrup;
            upsellStrataHTML = `
                <div class="keranjang-upsell-strata">
                    📈 Tambah <strong>${formatAngka(qtyDibutuhkan)} Krt</strong> lagi (total ${nextUpsellTier.QTY} Krt) 
                    untuk dapat potongan ${formatRupiah(nextUpsellTier[eceran])}/Krt.
                </div>
            `;
        } else {
            // Jika tidak ada tier yang lebih baik (sudah maks)
            upsellStrataHTML = `<div class="keranjang-upsell-strata tertinggi">🏆 Anda sudah di tier Strata tertinggi.</div>`;
        }
        // --- AKHIR LOGIKA UPSELL BARU ---

        // Gabungkan semua
        keranjangEl.innerHTML += grupHTML + itemListHTML + upsellStrataHTML;
    }
}

// --- FUNGSI UPSELL REGULER (BARU) ---
function renderUpsellReguler(totalBrutoPerGrup) {
    let recommendations = [];
    
    // (dbReguler diurutkan descending)
    for (const grup in totalBrutoPerGrup) {
        const brutoGrup = totalBrutoPerGrup[grup];
        let currentTierIndex = -1;

        // 1. Cari index tier saat ini
        for (let i = 0; i < dbReguler.length; i++) {
            if (brutoGrup >= dbReguler[i]['NOMINAL FAKTUR']) {
                currentTierIndex = i;
                break;
            }
        }
        
        // 2. Cek apakah ada tier berikutnya
        // Jika currentTierIndex = -1 (belum dapat diskon), nextTier adalah yang terakhir (index terendah)
        // Jika currentTierIndex = 0 (tier tertinggi), tidak ada nextTier
        let nextTier = null;
        if (currentTierIndex === -1 && dbReguler.length > 0) {
            // Belum dapat diskon, targetkan tier terendah
            nextTier = dbReguler[dbReguler.length - 1];
        } else if (currentTierIndex > 0) {
            // Sudah dapat diskon, targetkan tier di atasnya
            nextTier = dbReguler[currentTierIndex - 1];
        }
        
        if (nextTier && nextTier[grup] > 0) { // Pastikan grup ini dapat diskon
            const rpDibutuhkan = nextTier['NOMINAL FAKTUR'] - brutoGrup;
            if (rpDibutuhkan > 0) { // Hanya jika belum tercapai
                const diskonBaru = nextTier[grup] * 100; // Ubah ke persen
                recommendations.push(
                    `<li><strong>${grup}:</strong> Tambah <strong>${formatRupiah(rpDibutuhkan)}</strong> lagi (total ${formatRupiah(nextTier['NOMINAL FAKTUR'])}) 
                    untuk dapat diskon ${diskonBaru}%.</li>`
                );
            }
        } else if (currentTierIndex === 0) {
             recommendations.push(
                `<li><strong>${grup}:</strong> 🏆 Anda sudah di tier Reguler tertinggi.</li>`
            );
        }
    }

    if (recommendations.length > 0) {
        upsellRegulerEl.innerHTML = recommendations.join('');
    } else {
        upsellRegulerEl.innerHTML = '<li>(Tambahkan item untuk melihat rekomendasi)</li>';
    }
}


// ==========================================================
// FUNGSI LOGIKA INTI
// ==========================================================
function renderSimulasi() {
    // 1. Hitung Total Bruto & Agregasi
    let subtotalBruto = 0;
    let totalNilaiLoyalti = 0;
    let totalBrutoPerGrup = {}; 
    let totalKartonPerEceran = {}; 

    keranjang.forEach(item => {
        const produk = dbProduk.get(item.sku);
        if (!produk) return;

        const totalBrutoItem = (item.qtyKarton * produk.HargaKarton) + (item.qtyBox * produk.HargaBox);
        const totalKartonItem = item.qtyKarton + (item.qtyBox / produk.BOX_PER_CRT);
        
        const grupReguler = produk.GROUP;
        const grupEceran = produk.ECERAN;

        subtotalBruto += totalBrutoItem;
        totalBrutoPerGrup[grupReguler] = (totalBrutoPerGrup[grupReguler] || 0) + totalBrutoItem;
        totalKartonPerEceran[grupEceran] = (totalKartonPerEceran[grupEceran] || 0) + totalKartonItem;

        if (produk.ITEM_LOYALTI === 'Y') {
            totalNilaiLoyalti += totalBrutoItem;
        }
    });
    subtotalBrutoEl.innerText = formatRupiah(subtotalBruto);
    
    // 2. Panggil fungsi render keranjang & upsell
    renderKeranjang(totalKartonPerEceran);
    renderUpsellReguler(totalBrutoPerGrup);

    // 3. Hitung Diskon #1: Reguler
    let totalDiskonReguler = 0;
    for (const grup in totalBrutoPerGrup) {
        const brutoGrup = totalBrutoPerGrup[grup];
        const tier = dbReguler.find(t => brutoGrup >= t['NOMINAL FAKTUR']);
        if (tier && tier[grup]) {
            totalDiskonReguler += brutoGrup * tier[grup];
        }
    }
    diskonRegulerEl.innerText = `- ${formatRupiah(totalDiskonReguler)}`;

    // 4. Hitung Diskon #2: Strata
    let totalPotonganStrata = 0;
    for (const eceran in totalKartonPerEceran) {
        const qtyGrup = totalKartonPerEceran[eceran];
        
        // Cari tier SAAT INI (gunakan salinan array, reverse, find)
        const currentTier = [...dbStrata].reverse().find(tier => 
            qtyGrup >= tier.QTY && tier[eceran] > 0
        );
        
        if (currentTier) {
            const potonganPerKarton = currentTier[eceran];
            totalPotonganStrata += qtyGrup * potonganPerKarton;
        }
    }
    diskonStrataEl.innerText = `- ${formatRupiah(totalPotonganStrata)}`;

    // 5. Hitung Diskon #3: Tambahan
    let totalPotonganTambahan = 0;
    dbTambahan.forEach(promo => {
        const grupPromo = promo.GROUP;
        const qtyMin = promo.QTY;
        const potongan = promo.POT;
        
        if (totalKartonPerEceran[grupPromo] && totalKartonPerEceran[grupPromo] >= qtyMin) {
            totalPotonganTambahan += totalKartonPerEceran[grupPromo] * potongan;
        }
    });
    diskonTambahanEl.innerText = `- ${formatRupiah(totalPotonganTambahan)}`;

    // 6. Hitung Total Faktur
    const totalFaktur = subtotalBruto - totalDiskonReguler - totalPotonganStrata - totalPotonganTambahan;
    totalFakturEl.innerText = formatRupiah(totalFaktur);

    // 7. Hitung Diskon #4: COD
    let totalDiskonCOD = 0;
    const metodeBayar = 'COD'; // Hardcoded
    if (metodeBayar === 'COD') {
        const tier = dbCOD.find(t => totalFaktur >= t['NOMINAL FAKTUR']);
        if (tier) {
            totalDiskonCOD = totalFaktur * tier.COD;
        }
    }
    diskonCODEl.innerText = `- ${formatRupiah(totalDiskonCOD)}`;

    // 8. Hitung Diskon #5: Voucher
    const nilaiVoucherInput = parseFloat(inputVoucherEl.value) || 0;
    let nilaiVoucherTerpakai = nilaiVoucherInput;
    if (nilaiVoucherInput > totalNilaiLoyalti) {
        nilaiVoucherTerpakai = totalNilaiLoyalti; 
    }
    potonganVoucherEl.innerText = `- ${formatRupiah(nilaiVoucherTerpakai)}`;

    // 9. Hitung Harga Nett (On Faktur)
    const hargaNettOnFaktur = totalFaktur - totalDiskonCOD - nilaiVoucherTerpakai;
    totalNettOnFakturEl.innerText = formatRupiah(hargaNettOnFaktur);

    // 10. Simulasi Diskon #6: Loyalti
    let totalDiskonLoyalti = 0;
    const kelasLoyalti = kelasPelangganEl.value;
    const tierLoyalti = dbLoyalti.find(t => t.KELAS === kelasLoyalti);
    
    if (tierLoyalti) {
        totalDiskonLoyalti = hargaNettOnFaktur * tierLoyalti.REWARD;
    }
    diskonLoyaltiEl.innerText = `(${formatRupiah(totalDiskonLoyalti)})`;

    // 11. Hitung Harga Nett Akhir (Simulasi)
    const hargaNettAkhir = hargaNettOnFaktur - totalDiskonLoyalti;
    hargaNettAkhirEl.innerText = formatRupiah(hargaNettAkhir);
}

// --- Mulai aplikasi ---

document.addEventListener('DOMContentLoaded', init);
