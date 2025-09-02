// script.js

// Google Apps Script Web App URL.
// ENSURE THIS URL IS CORRECT AND DEPLOYED WITH PUBLIC ACCESS.
const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwQBV_TvoJBiUbhTG5zxxwPu3mGDG-gAf4fWrqJWtUtEu6R6hGDVpZVvayYlAiRSbeY/exec';

let originalData = []; // Global variable to store raw data from the API
let uniqueDosenNames = []; // Stores a list of unique faculty names (Dosen Pembimbing Akademik)
let dosenStats = {}; // Stores detailed statistics for each faculty member
let prodiStatsData = {}; // Stores detailed statistics per program study
let currentPage = 1;
const rowsPerPage = 10;
const fullTableRowsPerPage = 15;

let currentDosenFilter = null; // Stores the currently filtered faculty name for the supervised student page

/**
 * Displays a global message at the top of the page.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false if it's a loading/info message.
 */
function showGlobalMessage(message, isError = false) {
    const container = document.getElementById('globalMessageContainer');
    if (!container) {
        console.error("Global message container not found!");
        return;
    }
    container.innerHTML = `<span class="message-text">${message}</span><button class="close-button">&times;</button>`;
    container.className = 'global-message-container'; // Reset classes
    if (isError) {
        container.classList.add('error');
    } else {
        container.classList.add('loading');
    }
    container.style.display = 'block';

    // Add event listener to close button
    const closeButton = container.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = clearGlobalMessage;
    }
}

/**
 * Removes the global message from display.
 */
function clearGlobalMessage() {
    const container = document.getElementById('globalMessageContainer');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
        container.classList.remove('loading', 'error');
    }
}


/**
 * Displays the selected page and hides other pages.
 * Also manages active status in the sidebar.
 * @param {string} pageId - ID of the page element to display.
 */
function showPage(pageId) {
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(page => page.style.display = 'none');

    const contentPage = document.getElementById(pageId);
    if (contentPage) {
        contentPage.style.display = 'block';
    } else {
        console.error(`Error: Page element with ID '${pageId}' not found.`);
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active', 'open'));

    // Ensure menu ID casing matches HTML
    const basePageName = pageId.replace('Page', '');
    const capitalizedMenuSuffix = basePageName.charAt(0).toUpperCase() + basePageName.slice(1);
    const menuElementId = 'menu' + capitalizedMenuSuffix;

    // Special handling for supervised student detail page, activate Faculty Advisor menu
    if (pageId === 'mahasiswaBimbinganDetailPage') {
        document.getElementById('menuDosenPembimbing').classList.add('active');
    } else if (pageId === 'prodiStatsPage') { // If on Program Study Statistics page, activate Program Study Statistics menu
        document.getElementById('menuProdiStats').classList.add('active');
    }
    else {
        const menuElement = document.getElementById(menuElementId);
        if (menuElement) {
            menuElement.classList.add('active');
        } else {
            console.error(`Error: Sidebar menu element with ID '${menuElementId}' not found.`);
        }
    }

    // Reset filters and related data when changing pages
    // Except if the pageId is mahasiswaBimbinganDetailPage (because currentDosenFilter will be used)
    if (pageId !== 'mahasiswaBimbinganDetailPage') {
        currentDosenFilter = null; // Reset faculty filter
        const searchBoxBimbingan = document.getElementById('searchBoxBimbingan');
        // const statusFilterBimbingan = document.getElementById('statusFilterBimbingan'); // Removed: Status column no longer available
        if (searchBoxBimbingan) searchBoxBimbingan.value = '';
        // if (statusFilterBimbingan) statusFilterBimbingan.value = 'all'; // Removed: Status column no longer available

        const backButtonFromBimbingan = document.getElementById('backToDosenListFromBimbinganBtn');
        if(backButtonFromBimbingan) backButtonFromBimbingan.style.display = 'none';
    }

    // Reset faculty search on faculty list page when moving from that page
    if (pageId !== 'dosenPembimbingPage') {
        const searchBoxDosen = document.getElementById('searchBoxDosen');
        if (searchBoxDosen) {
            searchBoxDosen.value = '';
        }
    }

    // NEW: Reset program study dropdown on program study statistics page when moving from that page
    if (pageId !== 'prodiStatsPage') {
        const prodiSelector = document.getElementById('prodiSelectorForStats');
        if (prodiSelector) {
            prodiSelector.value = 'all'; // Reset to "Select Program Study"
            // Clear cards and display initial message
            const cardsContainer = document.getElementById('prodiSpecificStatsCards');
            if (cardsContainer) {
                cardsContainer.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color:#777;">Silakan pilih program studi dari dropdown di atas untuk melihat statistiknya.</p>';
                document.getElementById('currentProdiStatsName').innerText = 'Pilih Prodi'; // Reset title
            }
        }
    }


    currentPage = 1; // Reset pagination page every time page changes
}

// Sidebar Click Events
document.getElementById('menuDashboard').addEventListener('click', function() {
    showPage('dashboardPage');
});
document.getElementById('menuDataMahasiswa').addEventListener('click', function() {
    showPage('dataMahasiswaPage');
});
// Event listener for Faculty Advisor menu (directly displays faculty list)
document.getElementById('menuDosenPembimbing').addEventListener('click', function() {
    showPage('dosenPembimbingPage');
    updateDashboard(); // Load faculty list when page opens
});
// START: Event listener for new Program Study Statistics menu
document.getElementById('menuProdiStats').addEventListener('click', function() {
    showPage('prodiStatsPage');
    // Do not directly call updateDashboard, let the dropdown trigger card rendering
    // Just ensure program study dropdown is populated and initial message is displayed
    populateProdiSelectorForStats();
});
// END: Event listener for new Program Study Statistics menu
document.getElementById('menuAnalytics').addEventListener('click', function() {
    showPage('analyticsPage');
    updateDashboard(); // Ensure charts are re-rendered
});
document.getElementById('menuReport').addEventListener('click', function() {
    showPage('reportPage');
});
document.getElementById('showAllMahasiswa').addEventListener('click', function(e) {
    e.preventDefault();
    showPage('dataMahasiswaPage');
});

// Event listener for back button from supervised student details page
document.getElementById('backToDosenListFromBimbinganBtn').addEventListener('click', function() {
    showPage('dosenPembimbingPage'); // Go back to faculty list page
    updateDashboard(); // Update faculty list page
});


// Displays current date in the header
function displayCurrentDate() {
    const now = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('currentDate').innerText = now.toLocaleDateString('en-GB', options).replace(/\//g, '/');
}

/**
 * Fetches data from Google Apps Script Web App URL.
 * Handles potential errors from fetch operation or Apps Script response.
 */
async function loadDataFromAppsScript() {
    clearGlobalMessage(); // Clear previous messages (error/loading)
    showGlobalMessage('Memuat data, mohon tunggu...', false); // Display loading message

    try {
        const response = await fetch(appsScriptUrl);
        const result = await response.json();

        if (result.error) {
            console.error('Error from Apps Script:', result.error);
            showGlobalMessage(`Gagal memuat data: ${result.error}. Pastikan URL Apps Script benar dan dapat diakses.`, true);
            // Clear error messages from individual tables as a global message is now present
            document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
            document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
            document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat daftar dosen.</p>`;
            document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data bimbingan.</p>`;
            return;
        }

        if (result.data) {
            originalData = result.data;
            // Extract unique Dosen Pembimbing Akademik names and calculate statistics
            const dosenSet = new Set();
            const tempDosenStats = {};
            const tempProdiStatsData = {}; // Object to store statistics per program study

            originalData.forEach(d => {
                const dpaName = d["Dosen Pembimbing Akademik"]; // Column name from CSV
                const prodi = d["Program Studi"] || "Tidak Diketahui"; // Column name from CSV
                const beasiswaStatus = d["Beasiswa"] || "Tidak Diketahui"; // Column name from CSV (e.g., "KIPK", "Non KIPK")

                // Calculate Faculty Statistics (Dosen Pembimbing Akademik)
                if (dpaName) {
                    dosenSet.add(dpaName);
                    if (!tempDosenStats[dpaName]) {
                        tempDosenStats[dpaName] = { total: 0, "KIPK": 0, "Non KIPK": 0, "Tidak Diketahui Beasiswa": 0 };
                    }
                    tempDosenStats[dpaName].total++;
                    if (beasiswaStatus === "KIPK") {
                        tempDosenStats[dpaName]["KIPK"]++;
                    } else if (beasiswaStatus === "Non KIPK") {
                        tempDosenStats[dpaName]["Non KIPK"]++;
                    } else {
                        tempDosenStats[dpaName]["Tidak Diketahui Beasiswa"]++;
                    }
                }

                // Calculate Program Study Statistics
                if (!tempProdiStatsData[prodi]) {
                    tempProdiStatsData[prodi] = { total: 0, "KIPK": 0, "Non KIPK": 0, "Tidak Diketahui Beasiswa": 0 };
                }
                tempProdiStatsData[prodi].total++;
                if (beasiswaStatus === "KIPK") {
                    tempProdiStatsData[prodi]["KIPK"]++;
                } else if (beasiswaStatus === "Non KIPK") {
                    tempProdiStatsData[prodi]["Non KIPK"]++;
                } else {
                    tempProdiStatsData[prodi]["Tidak Diketahui Beasiswa"]++;
                }
            });

            uniqueDosenNames = Array.from(dosenSet).sort();
            dosenStats = tempDosenStats; // Store complete faculty statistics
            prodiStatsData = tempProdiStatsData; // Store complete program study statistics

            populateProdiFilter(originalData);
            populateStatusFilter(originalData); // This now handles 'Beasiswa' filter
            populateStatusFilterBimbingan(originalData); // This now handles 'Beasiswa' filter for bimbingan detail page
            populateProdiSelectorForStats(); // Populate dropdown on Program Study Statistics page
            updateDashboard(); // Update the entire dashboard with the newly loaded data
            clearGlobalMessage(); // Data loaded successfully, clear loading message
        } else {
            console.warn('No data received from Apps Script.');
            showGlobalMessage('Tidak ada data yang ditemukan.', false); // Info message, not error
            document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data ditemukan.</p>`;
            document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data ditemukan.</p>`;
            document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada dosen ditemukan.</p>`;
            document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data bimbingan ditemukan.</p>`;
        }

    } catch (error) {
        console.error('Error fetching data from Apps Script:', error);
        showGlobalMessage(`Gagal memuat data: ${error.message}. Pastikan URL Apps Script benar dan dapat diakses.`, true);
        document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
        document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
        document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat daftar dosen.</p>`;
        document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data bimbingan.</p>`;
    }
}

/**
 * Populates the Program Study filter dropdown.
 * @param {Array<Object>} data - Student data.
 */
function populateProdiFilter(data) {
    const prodiSet = new Set(data.map(d => d["Program Studi"]).filter(Boolean));
    const dropdown = document.getElementById("prodiFilter");
    dropdown.innerHTML = '<option value="all">Semua Program Studi</option>';
    Array.from(prodiSet).sort().forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        dropdown.appendChild(option);
    });
}

/**
 * Populates the Program Study dropdown for the Program Study Statistics page.
 */
function populateProdiSelectorForStats() {
    const prodiSelector = document.getElementById('prodiSelectorForStats');
    if (!prodiSelector) return;

    // Clear old options except "Select Program Study"
    prodiSelector.innerHTML = '<option value="all">Pilih Program Studi</option>';

    // Get unique program study list from calculated data (prodiStatsData)
    const uniqueProdi = Object.keys(prodiStatsData).sort();

    uniqueProdi.forEach(prodiName => {
        const option = document.createElement('option');
        option.value = prodiName;
        option.textContent = prodiName;
        prodiSelector.appendChild(option);
    });

    // Add event listener when selection changes
    prodiSelector.onchange = function() {
        const selectedProdi = this.value;
        if (selectedProdi === 'all') {
            document.getElementById('prodiSpecificStatsCards').innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color:#777;">Silakan pilih program studi dari dropdown di atas untuk melihat statistiknya.</p>';
            document.getElementById('currentProdiStatsName').innerText = 'Pilih Prodi';
            generateProdiStatsTable(originalData, 'recentMahasiswaTable'); // Show global prodi table if "all" is selected
        } else {
            document.getElementById('currentProdiStatsName').innerText = selectedProdi;
            renderProdiSpecificStatsCards(selectedProdi);
            // Optionally, filter the table for this specific prodi as well
            const filteredProdiData = originalData.filter(d => d["Program Studi"] === selectedProdi);
            generateProdiStatsTable(filteredProdiData, 'recentMahasiswaTable'); // Update table based on selected prodi
        }
    };
}

/**
 * Populates the Beasiswa filter dropdown.
 * @param {Array<Object>} data - Student data.
 */
function populateStatusFilter(data) {
    const beasiswaSet = new Set(data.map(d => d.Beasiswa).filter(Boolean)); // Use 'Beasiswa' column
    const dropdown = document.getElementById("statusFilter"); // Reusing this ID for 'Beasiswa'
    dropdown.innerHTML = '<option value="all">Semua Jenis Beasiswa</option>'; // Changed text
    Array.from(beasiswaSet).sort().forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        dropdown.appendChild(option);
    });
}

/**
 * Populates the Beasiswa filter dropdown for the supervised student details page.
 * @param {Array<Object>} data - Student data.
 */
function populateStatusFilterBimbingan(data) {
    const beasiswaSet = new Set(data.map(d => d.Beasiswa).filter(Boolean)); // Use 'Beasiswa' column
    const dropdown = document.getElementById("statusFilterBimbingan"); // Reusing this ID
    dropdown.innerHTML = '<option value="all">Semua Jenis Beasiswa</option>'; // Changed text
    Array.from(beasiswaSet).sort().forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        dropdown.appendChild(option);
    });
}

/**
 * Updates the faculty list table (on dosenPembimbingPage).
 * This will display a clickable table of faculty members (Dosen Pembimbing Akademik).
 */
function updateDosenListTable() {
    const tableContainer = document.getElementById('dosenListTable');
    if (!tableContainer) return;

    const keyword = document.getElementById('searchBoxDosen').value.toLowerCase();
    const filteredDosen = uniqueDosenNames.filter(dosen => dosen.toLowerCase().includes(keyword));

    if (filteredDosen.length === 0) {
        tableContainer.innerHTML = "<p style='text-align:center;'>Tidak ada dosen ditemukan dengan kriteria ini.</p>";
        return;
    }

    let tableHTML = `<table><thead>
        <tr>
            <th>No</th>
            <th>Nama Dosen Pembimbing Akademik</th>
            <th>Jumlah Mahasiswa Bimbingan</th>
            <th>Mahasiswa KIPK</th>
            <th>Mahasiswa Non-Beasiswa</th>
        </tr>
    </thead><tbody>`;

    filteredDosen.forEach((dosenName, i) => {
        const stats = dosenStats[dosenName] || {total: 0, KIPK: 0, "Non KIPK": 0, "Tidak Diketahui Beasiswa": 0};
        tableHTML += `<tr data-dosen-name="${dosenName}">
            <td>${i + 1}</td>
            <td class="nama-dosen">${dosenName}</td>
            <td>${stats.total}</td>
            <td>${stats.KIPK}</td>
            <td>${stats["Non KIPK"]}</td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;

    // Add event listener to each faculty row
    const dosenRows = tableContainer.querySelectorAll('tbody tr');
    dosenRows.forEach(row => {
        row.addEventListener('click', function() {
            const dosenName = this.dataset.dosenName;
            currentDosenFilter = dosenName; // Set global faculty filter
            document.getElementById('currentDosenName').innerText = dosenName; // Update heading on detail page
            showPage('mahasiswaBimbinganDetailPage'); // Display supervised student details page
            updateDashboard(); // Update dashboard to display supervised students for this faculty member
            document.getElementById('backToDosenListFromBimbinganBtn').style.display = 'block'; // Display back button
        });
    });
}


/**
 * Renders faculty statistics cards on the mahasiswaBimbinganDetailPage.
 * @param {string} dosenName - Name of the faculty member (Dosen Pembimbing Akademik) whose supervision statistics will be displayed.
 */
function renderDosenStatsCards(dosenName) {
    const cardsContainer = document.getElementById('dosenStatsCards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = ''; // Clear old cards

    const stats = dosenStats[dosenName] || {};
    const totalBimbingan = stats.total || 0;

    const statOrder = [
        { label: "Total Dibimbing", key: "total", icon: "fas fa-users" },
        { label: "Mahasiswa KIPK", key: "KIPK", icon: "fas fa-users" },
        { label: "Mahasiswa Non-Beasiswa", key: "Non KIPK", icon: "fas fa-users" }
        // If "Tidak Diketahui Beasiswa" needs a card:
        // { label: "Beasiswa Tidak Diketahui", key: "Tidak Diketahui Beasiswa", icon: "fas fa-question-circle" }
    ];

    statOrder.forEach(stat => {
        const value = stats[stat.key] || 0;
        const percentage = totalBimbingan > 0 ? ((value / totalBimbingan) * 100).toFixed(1) : 0;
        const cardClass = stat.key.replace(/\s/g, ''); // Remove spaces for CSS class
        // Ensure class name is valid for CSS (e.g., "KIPK" becomes "KIPK", "Non KIPK" becomes "NonBeasiswa")
        let finalCardClass = stat.key.replace(/\s/g, '');
        if (finalCardClass === "NonBeasiswa") finalCardClass = "NonBeasiswa"; // Specific class for CSS

        const cardHtml = `
            <div class="dosen-summary-card ${finalCardClass}">
                <div class="label"><i class="${stat.icon}"></i> ${stat.label}</div>
                <div class="value">${value}</div>
                <div class="percentage">${percentage}%</div>
            </div>
        `;
        cardsContainer.innerHTML += cardHtml;
    });
}


/**
 * Renders specific statistics cards for the selected program study.
 * @param {string} prodiName - Name of the program study whose statistics will be displayed.
 */
function renderProdiSpecificStatsCards(prodiName) {
    const cardsContainer = document.getElementById('prodiSpecificStatsCards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = ''; // Clear old cards

    const stats = prodiStatsData[prodiName] || {}; // Get statistics data from prodiStatsData

    const totalMahasiswaProdi = stats.total || 0;

    // Define order and labels of cards according to program study
    let statOrder = [
        { label: `Jumlah Mahasiswa`, key: "total", icon: "fas fa-users" },
        { label: "Mahasiswa KIPK", key: "KIPK", icon: "fas fa-users" },
        { label: "Mahasiswa Non-Beasiswa", key: "Non KIPK", icon: "fas fa-users" }
    ];

    // Define common card background colors
    const commonCardColors = {
        "total": "#eaf6ff", // Light blue
        "KIPK": "#f8d7da", // Success (light green)
        "Non KIPK": "#d4edda", // Light red
        "Tidak Diketahui Beasiswa": "#7f8c8d" // Default gray for unknown
    };

    statOrder.forEach(stat => {
        const value = stats[stat.key] || 0;
        const percentage = totalMahasiswaProdi > 0 ? ((value / totalMahasiswaProdi) * 100).toFixed(1) : 0;
        let cardClass = stat.key.replace(/\s/g, ''); // Remove spaces for CSS class

        // Use custom color from commonCardColors if available, default to #f8f9fa
        const backgroundColor = commonCardColors[stat.key] || '#f8f9fa';

        const cardHtml = `
            <div class="dosen-summary-card ${cardClass}" style="background-color: ${backgroundColor};">
                <div class="label"><i class="${stat.icon}"></i> ${stat.label}</div>
                <div class="value">${value}</div>
                <div class="percentage">${percentage}%</div>
            </div>
        `;
        cardsContainer.innerHTML += cardHtml;
    });
}


/**
 * Updates overview statistics on the dashboard and circular progress bars.
 * @param {Array<Object>} data - Filtered student data.
 */
function updateStats(data) {
    const totalMahasiswa = data.length;

    const prodiSISet = data.filter(d => d["Program Studi"] === "Sistem Informasi").length;
    const prodiTISet = data.filter(d => d["Program Studi"] === "Teknik Informatika").length;
    const prodiTMJSet = data.filter(d => d["Program Studi"] === "Teknik Multimedia Dan Jaringan").length;
    const prodiKASet = data.filter(d => d["Program Studi"] === "Komputerisasi Akuntansi").length;
    const mahasiswaKIPKCount = data.filter(d => d.Beasiswa === "KIPK").length; // Count KIPK specifically

    const totalMahasiswaPercent = 100; // Always 100% for the total card
    const prodiSIPercent = totalMahasiswa > 0 ? (prodiSISet / totalMahasiswa * 100).toFixed(1) : 0;
    const prodiTIPercent = totalMahasiswa > 0 ? (prodiTISet / totalMahasiswa * 100).toFixed(1) : 0;
    const prodiTMJPercent = totalMahasiswa > 0 ? (prodiTMJSet / totalMahasiswa * 100).toFixed(1) : 0;
    const prodiKAPercent = totalMahasiswa > 0 ? (prodiKASet / totalMahasiswa * 100).toFixed(1) : 0;
    const kipkPercent = totalMahasiswa > 0 ? (mahasiswaKIPKCount / totalMahasiswa * 100).toFixed(1) : 0; // KIPK percentage

    document.getElementById("totalMahasiswaSkripsiTA").innerText = totalMahasiswa; // Renamed ID to be more generic
    document.getElementById("jumlahProdiSI").innerText = prodiSISet;
    document.getElementById("jumlahProdiTI").innerText = prodiTISet;
    document.getElementById("jumlahProdiTMJ").innerText = prodiTMJSet;
    document.getElementById("jumlahProdiKA").innerText = prodiKASet;
    document.getElementById("jumlahMahasiswaBeasiswa").innerText = mahasiswaKIPKCount; // Update for KIPK count


    updateCircularProgress('totalMahasiswaSkripsiTAProgress', totalMahasiswaPercent); // Generic total
    updateCircularProgress('jumlahProdiSIProgress', prodiSIPercent);
    updateCircularProgress('jumlahProdiTIProgress', prodiTIPercent);
    updateCircularProgress('jumlahProdiTMJProgress', prodiTMJPercent);
    updateCircularProgress('jumlahProdiKAProgress', prodiKAPercent);
    updateCircularProgress('jumlahMahasiswaBeasiswaProgress', kipkPercent); // Update for KIPK percentage


    document.getElementById("totalMahasiswaSkripsiTAChange").innerText = `${totalMahasiswaPercent}%`; // Generic total
    document.getElementById("jumlahProdiSIChange").innerText = `${prodiSIPercent}%`;
    document.getElementById("jumlahProdiTIChange").innerText = `${prodiTIPercent}%`;
    document.getElementById("jumlahProdiTMJChange").innerText = `${prodiTMJPercent}%`;
    document.getElementById("jumlahProdiKAChange").innerText = `${prodiKAPercent}%`;
    document.getElementById("jumlahMahasiswaBeasiswaChange").innerText = `${kipkPercent}%`; // Update for KIPK percentage
}


/**
 * Updates the circular progress bar based on CSS.
 * @param {string} elementId - ID of the inner text element.
 * @param {number} percentage - Percentage value (0-100).
 */
function updateCircularProgress(elementId, percentage) {
    const innerTextElement = document.getElementById(elementId);
    const progressBarContainer = innerTextElement.closest('.circular-progress');
    if (!progressBarContainer) return;

    const gradientElement = progressBarContainer.querySelector('.circular-progress-gradient');
    if (gradientElement) {
        gradientElement.style.setProperty('--progress', `${percentage}%`);
    }
    innerTextElement.innerText = `${percentage}%`;
}


/**
 * Updates the detailed student table.
 * @param {Array<Object>} data - Filtered student data.
 * @param {string} targetElementId - ID of the div element to place the table in.
 * @param {number} limit - Number of rows to display (for latest orders).
 * @param {boolean} showPagination - Whether to display pagination buttons.
 */
function updateTable(data, targetElementId, limit = null, showPagination = true) {
    const tableContainer = document.getElementById(targetElementId);
    if (!tableContainer) return;

    if (data.length === 0) {
        tableContainer.innerHTML = "<p style='text-align:center;'>Tidak ada data ditemukan.</p>";
        return;
    }

    let dataToRender = data;
    let currentRowsPerPage = rowsPerPage;
    // Apply fullTableRowsPerPage only for student detail table and supervised student table
    if (targetElementId === 'detailTable' || targetElementId === 'mahasiswaBimbinganTable') {
        currentRowsPerPage = fullTableRowsPerPage;
    }

    const totalPages = Math.ceil(data.length / currentRowsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    if (currentPage < 1 && totalPages > 0) currentPage = 1;
    if (totalPages === 0) currentPage = 0;


    const start = (currentPage - 1) * currentRowsPerPage;
    if (limit) {
        dataToRender = data.slice(start, start + limit);
    } else {
        dataToRender = data.slice(start, start + currentRowsPerPage);
    }

    // Adjust table headers to match new CSV columns
    let tableHTML = `<table><thead>
        <tr>
            <th>No</th>
            <th>NIM</th>
            <th>Nama</th>
            <th>Program Studi</th>
            <th>Dosen Pembimbing Akademik</th>
            <th>Beasiswa</th>
        </tr>
    </thead><tbody>`;

    dataToRender.forEach((d, i) => {
        const beasiswaVal = d.Beasiswa || '-';
        let beasiswaClass = "";
        if (beasiswaVal === "KIPK") {
            beasiswaClass = "beasiswa-kipk"; // Add this class to CSS for styling KIPK
        } else if (beasiswaVal === "Non KIPK") {
            beasiswaClass = "beasiswa-non"; // Add this class to CSS for styling Non KIPK
        } else {
            beasiswaClass = "beasiswa-unknown"; // Default for unknown/other
        }

        tableHTML += `<tr>
            <td>${start + i + 1}</td>
            <td>${d.NIM || '-'}</td>
            <td class="nama">${d.Nama || '-'}</td>
            <td class="program-studi">${d["Program Studi"] || '-'}</td>
            <td>${d["Dosen Pembimbing Akademik"] || '-'}</td>
            <td><span class="status-badge ${beasiswaClass}">${beasiswaVal}</span></td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;

    if (showPagination) {
        tableHTML += `<div style="text-align:center; margin-top:15px;">
            <button onclick="prevPage()" class="pagination-button" ${currentPage === 1 || totalPages === 0 ? 'disabled' : ''}>❮</button>
            <span style="margin: 0 10px;">Page ${currentPage} of ${totalPages}</span>
            <button onclick="nextPage()" class="pagination-button" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>❯</button>
        </div>`;
    }

    tableContainer.innerHTML = tableHTML;
}

// Global pagination functions - adjusted to always call updateDashboard
function nextPage() {
    currentPage++;
    updateDashboard();
}

function prevPage() {
    currentPage--;
    updateDashboard();
}


/**
 * Generates a statistics table based on Program Study.
 * This table will now show counts per Program Studi, KIPK, and Non-Beasiswa status.
 * @param {Array<Object>} data - Student data.
 * @param {string} targetElementId - ID of the div element to place the table in.
 */
function generateProdiStatsTable(data, targetElementId) {
    const tableContainer = document.getElementById(targetElementId);
    if (!tableContainer) return;

    if (data.length === 0) {
        tableContainer.innerHTML = "<p style='text-align:center;'>Tidak ada data statistik program studi ditemukan.</p>";
        return;
    }

    const prodiStats = {};
    data.forEach(d => {
        const prodi = d["Program Studi"] || "Tidak Diketahui";
        const beasiswaVal = d["Beasiswa"] || "Tidak Diketahui";

        if (!prodiStats[prodi]) {
            prodiStats[prodi] = {
                total: 0,
                "KIPK": 0,
                "Non KIPK": 0,
                "Jumlah DPA": new Set() // To count unique DPA per prodi
            };
        }
        prodiStats[prodi].total++;

        if (beasiswaVal === "KIPK") {
            prodiStats[prodi]["KIPK"]++;
        } else if (beasiswaVal === "Non KIPK") {
            prodiStats[prodi]["Non KIPK"]++;
        }

        if (d["Dosen Pembimbing Akademik"]) {
            prodiStats[prodi]["Jumlah DPA"].add(d["Dosen Pembimbing Akademik"]);
        }
    });

    let prodiStatsArray = Object.entries(prodiStats).map(([prodiName, stats]) => ({
        prodi: prodiName,
        total: stats.total,
        KIPK: stats.KIPK,
        "Non KIPK": stats["Non KIPK"],
        uniqueDPA: stats["Jumlah DPA"].size // Count of unique DPA
    }));

    prodiStatsArray.sort((a, b) => b.total - a.total);

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>No</th>
                    <th>Program Studi</th>
                    <th>Jumlah Mahasiswa</th>
                    <th>Mahasiswa KIPK</th>
                    <th>Mahasiswa Non-Beasiswa</th>
                    
                </tr>
            </thead>
            <tbody>
    `;

    prodiStatsArray.forEach((stats, i) => {
        tableHTML += `
            <tr>
                <td>${i + 1}</td>
                <td>${stats.prodi}</td>
                <td>${stats.total}</td>
                <td>${stats.KIPK}</td>
                <td>${stats["Non KIPK"]}</td>
                
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    tableContainer.innerHTML = tableHTML;
}


/**
 * Updates all charts in the Analytics section.
 * @param {Array<Object>} data - Filtered student data.
 */
function updateCharts(data) {
    // Custom color definitions for Program Study Population
    const prodiColorsMapping = {
        "Sistem Informasi": '#3498db', // Blue
        "Teknik Informatika": '#f39c12', // Orange
        "Komputerisasi Akuntansi": '#2ecc71', // Green
        "Teknik Multimedia dan Jaringan": '#9b59b6' // Purple
    };
    generatePieChart(countOccurrences(data, 'Program Studi'), 'programStudiChart', 'Distribusi Mahasiswa per Program Studi', prodiColorsMapping);

    // New chart for Beasiswa distribution (KIPK vs Non KIPK)
    const beasiswaCounts = countOccurrences(data, 'Beasiswa');
    const beasiswaColors = {
        "KIPK": '#f8d7da', // Green for KIPK
        "Non KIPK": '#d4edda' // Red for Non KIPK
    };
    generatePieChart(beasiswaCounts, 'progressStatusChartSI', 'Distribusi Mahasiswa Berdasarkan Jenis Beasiswa', beasiswaColors); // Reusing SI chart ID for now
    document.getElementById('progressStatusChartSI').closest('.section').querySelector('h3').innerText = 'Distribusi Mahasiswa Berdasarkan Jenis Beasiswa';

    // Remove other program study charts as the data structure for progress is gone
    document.getElementById('progressStatusChartTI').innerHTML = '<p style="text-align:center; color:#777;">Grafik ini tidak relevan dengan struktur data saat ini.</p>';
    document.getElementById('progressStatusChartTI').closest('.section').querySelector('h3').innerText = 'Grafik Studi Akhir - Teknik Informatika (Tidak Relevan)';
    document.getElementById('progressStatusChartTMJ').innerHTML = '<p style="text-align:center; color:#777;">Grafik ini tidak relevan dengan struktur data saat ini.</p>';
    document.getElementById('progressStatusChartTMJ').closest('.section').querySelector('h3').innerText = 'Grafik Studi Akhir - Teknik Multimedia dan Jaringan (Tidak Relevan)';
    document.getElementById('progressStatusChartKA').innerHTML = '<p style="text-align:center; color:#777;">Grafik ini tidak relevan dengan struktur data saat ini.</p>';
    document.getElementById('progressStatusChartKA').closest('.section').querySelector('h3').innerText = 'Grafik Studi Akhir - Komputerisasi Akuntansi (Tidak Relevan)';

    // Optional: Add a bar chart for Dosen Pembimbing Akademik workload
    // You'd need a new div in analyticsPage for this if you want it as a dedicated chart
    // For now, let's keep it simple and just update existing sections or add if HTML is updated.
    // This could be a good use for 'progressStatusChartTI' if renamed.
}

/**
 * Counts occurrences of values in a given column.
 * @param {Array<Object>} data - Student data.
 * @param {string} key - The column key to count.
 * @returns {Object} - Object containing occurrence counts.
 */
function countOccurrences(data, key) {
    return data.reduce((acc, row) => {
        const value = row[key] || 'Tidak diketahui';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

/**
 * Gets filtered student data based on the active page.
 * @returns {Array<Object>} - Filtered student data.
 */
function getFilteredData() {
    const dataMahasiswaPage = document.getElementById('dataMahasiswaPage');
    const dosenPembimbingPage = document.getElementById('dosenPembimbingPage');
    const mahasiswaBimbinganDetailPage = document.getElementById('mahasiswaBimbinganDetailPage');
    const analyticsPage = document.getElementById('analyticsPage');
    const prodiStatsPage = document.getElementById('prodiStatsPage');

    if (dataMahasiswaPage.style.display === 'block') {
        const keyword = document.getElementById('searchBox').value.toLowerCase();
        const beasiswaFilter = document.getElementById('statusFilter').value; // Now for 'Beasiswa'
        const prodiFilter = document.getElementById('prodiFilter').value;

        return originalData.filter(d => {
            // Using 'Nama' and 'NIM' columns
            const matchKeyword = (!keyword || (d.Nama && d.Nama.toLowerCase().includes(keyword)) || (d.NIM && String(d.NIM).toLowerCase().includes(keyword)));
            const matchBeasiswa = (beasiswaFilter === 'all' || d.Beasiswa === beasiswaFilter);
            const matchProdi = (prodiFilter === 'all' || d["Program Studi"] === prodiFilter);
            return matchKeyword && matchBeasiswa && matchProdi;
        });
    } else if (mahasiswaBimbinganDetailPage.style.display === 'block' && currentDosenFilter) {
        const keywordBimbingan = document.getElementById('searchBoxBimbingan').value.toLowerCase();
        const beasiswaFilterBimbingan = document.getElementById('statusFilterBimbingan').value; // Now for 'Beasiswa'

        return originalData.filter(d => {
            const matchDosen = d["Dosen Pembimbing Akademik"] === currentDosenFilter; // Use "Dosen Pembimbing Akademik"

            const matchKeyword = (!keywordBimbingan || (d.Nama && d.Nama.toLowerCase().includes(keywordBimbingan)) || (d.NIM && String(d.NIM).toLowerCase().includes(keywordBimbingan)));
            const matchBeasiswa = (beasiswaFilterBimbingan === 'all' || d.Beasiswa === beasiswaFilterBimbingan);

            return matchDosen && matchKeyword && matchBeasiswa;
        });
    } else if (analyticsPage.style.display === 'block') {
        return originalData;
    } else if (dosenPembimbingPage.style.display === 'block') {
        return originalData;
    } else if (prodiStatsPage.style.display === 'block') {
        return originalData;
    }
    return originalData;
}

/**
 * Updates all parts of the dashboard (statistics, tables, and charts)
 * based on the active page.
 */
function updateDashboard() {
    const dashboardPage = document.getElementById('dashboardPage');
    const dataMahasiswaPage = document.getElementById('dataMahasiswaPage');
    const dosenPembimbingPage = document.getElementById('dosenPembimbingPage');
    const mahasiswaBimbinganDetailPage = document.getElementById('mahasiswaBimbinganDetailPage');
    const analyticsPage = document.getElementById('analyticsPage');
    const prodiStatsPage = document.getElementById('prodiStatsPage');

    const filteredDataForContext = getFilteredData();

    if (dashboardPage.style.display === 'block') {
        updateStats(filteredDataForContext);
        generateProdiStatsTable(filteredDataForContext, 'recentMahasiswaTable');
    } else if (dataMahasiswaPage.style.display === 'block') {
        updateTable(filteredDataForContext, 'detailTable', null, true);
    } else if (dosenPembimbingPage.style.display === 'block') {
        updateDosenListTable();
    } else if (mahasiswaBimbinganDetailPage.style.display === 'block') {
        updateTable(filteredDataForContext, 'mahasiswaBimbinganTable', null, true);
        if (currentDosenFilter) {
            renderDosenStatsCards(currentDosenFilter);
        }
    } else if (analyticsPage.style.display === 'block') {
        updateCharts(filteredDataForContext);
    } else if (prodiStatsPage.style.display === 'block') {
        // The individual overview cards on prodiStatsPage are now rendered by renderProdiSpecificStatsCards based on dropdown selection
        generateProdiStatsTable(filteredDataForContext, 'recentMahasiswaTable'); // Reusing 'recentMahasiswaTable' for the main Prodi Stats Table on this page
        const prodiSelector = document.getElementById('prodiSelectorForStats');
        if (prodiSelector && prodiSelector.value !== 'all') {
            renderProdiSpecificStatsCards(prodiSelector.value);
        } else {
            // If "Pilih Program Studi" is selected, ensure we generate the table for ALL data, not filtered
            generateProdiStatsTable(originalData, 'recentMahasiswaTable');
        }
    }
}

// Initialization when the page loads
window.onload = function() {
    displayCurrentDate();
    loadDataFromAppsScript();

    const searchBox = document.getElementById('searchBox');
    const statusFilter = document.getElementById('statusFilter'); // Now for 'Beasiswa'
    const prodiFilter = document.getElementById('prodiFilter');
    if (searchBox) searchBox.addEventListener('input', function() { currentPage = 1; updateDashboard(); });
    if (statusFilter) statusFilter.addEventListener('change', function() { currentPage = 1; updateDashboard(); }); // Now for 'Beasiswa'
    if (prodiFilter) prodiFilter.addEventListener('change', function() { currentPage = 1; updateDashboard(); });

    const searchBoxDosen = document.getElementById('searchBoxDosen');
    if (searchBoxDosen) searchBoxDosen.addEventListener('input', function() { currentPage = 1; updateDashboard(); });

    const searchBoxBimbingan = document.getElementById('searchBoxBimbingan');
    const statusFilterBimbingan = document.getElementById('statusFilterBimbingan'); // Now for 'Beasiswa'
    if (searchBoxBimbingan) searchBoxBimbingan.addEventListener('input', function() { currentPage = 1; updateDashboard(); });
    if (statusFilterBimbingan) statusFilterBimbingan.addEventListener('change', function() { currentPage = 1; updateDashboard(); });

    document.getElementById('refreshDataBtn').addEventListener('click', function() {
        console.log('Refreshing data...');
        loadDataFromAppsScript();
    });

    document.getElementById('sidebarToggle').addEventListener('click', function() {
        document.body.classList.toggle('sidebar-collapsed');
    });

    showPage('dashboardPage');
};

// --- Plotly Chart Functions ---

/**
 * Generates a pie chart using Plotly.
 * @param {Object} dataCounts - Object containing category counts (label: count).
 * @param {string} targetElementId - ID of the div element to place the chart in.
 * @param {string} title - Chart title.
 * @param {Object} [colorMapping] - Optional: Object mapping label names to color codes.
 */
function generatePieChart(dataCounts, targetElementId, title, colorMapping = {}) {
    const labels = Object.keys(dataCounts);
    const values = Object.values(dataCounts);

    // Determine colors based on mapping or default Plotly colors
    const colors = labels.map(label => {
        if (colorMapping[label]) {
            return colorMapping[label];
        }
        // Default colors if not in mapping
        switch (label) {
            case "Sistem Informasi": return '#3498db'; // Blue
            case "Teknik Informatika": return '#f39c12'; // Orange
            case "Komputerisasi Akuntansi": return '#2ecc71'; // Green
            case "Teknik Multimedia dan Jaringan": return '#9b59b6'; // Purple
            case "KIPK": return '#f8d7da'; // Green for KIPK
            case "Non KIPK": return '#d4edda'; // Red for Non KIPK
            default: return '#7f8c8d'; // Default gray
        }
    });

    const data = [{
        labels: labels,
        values: values,
        type: 'pie',
        hoverinfo: 'label+percent',
        textinfo: 'percent',
        insidetextorientation: 'radial',
        marker: {
            colors: colors // Use the determined color array
        },
        automargin: true
    }];

    const layout = {
        title: title,
        height: 400,
        margin: { t: 40, b: 20, l: 20, r: 20 },
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#333'
        },
        legend: {
            orientation: "h",
            x: 0,
            y: -0.15,
            traceorder: 'normal',
            font: {
                size: 10
            }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };

    Plotly.newPlot(targetElementId, data, layout, {responsive: true, displayModeBar: false});
}


/**
 * Generates a pie chart for student progress per stage, specifically for each program study.
 * This function will now be repurposed or removed as academic progress status is gone.
 * For now, I've adjusted it to be more generic if needed, but it's largely superseded by generatePieChart.
 * @param {Array<Object>} data - Student data filtered for a specific context.
 * @param {string} contextName - Context name (e.g., Program study name).
 * @param {string} targetElementId - ID of the div element to place the chart in.
 * @param {string} title - Chart title.
 * @param {Array<string>} specificCategories - Array of specific categories (e.g., "KIPK", "Non KIPK").
 */
function generateProdiProgressPieChart(data, contextName, targetElementId, title, specificCategories) {
    const categoryCounts = {};
    specificCategories.forEach(cat => categoryCounts[cat] = 0);

    data.forEach(d => {
        const category = d.Beasiswa; // Now using 'Beasiswa'
        if (specificCategories.includes(category)) {
            categoryCounts[category]++;
        }
    });

    // Mapping for display labels and custom colors
    const customCategoryMapping = {
        "KIPK": { label: "KIPK", color: '#f8d7da' },   // Green
        "Non KIPK": { label: "Non-Beasiswa", color: '#d4edda' } // Red
    };

    // Order of labels to display in the pie chart and corresponding colors
    const labels = specificCategories.map(cat => customCategoryMapping[cat] ? customCategoryMapping[cat].label : cat);
    const values = specificCategories.map(cat => categoryCounts[cat]);
    const colors = specificCategories.map(cat => customCategoryMapping[cat] ? customCategoryMapping[cat].color : '#7f8c8d'); // Default gray


    const dataPlotly = [{
        labels: labels, // Labels for pie slices
        values: values, // Values for pie slices
        type: 'pie',
        hoverinfo: 'label+percent+value', // Display label, percentage, and value on hover
        textinfo: 'percent', // Display percentage inside slices
        insidetextorientation: 'radial', // Orientation of percentage text
        marker: {
            colors: colors // Use the determined color array
        },
        automargin: true // Prevents labels and legend from being cut off
    }];

    const layout = {
        title: title,
        height: 400, // Sufficient height for pie chart
        margin: { t: 40, b: 20, l: 20, r: 20 }, // Adjust margins
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#333'
        },
        legend: {
            orientation: "h", // Horizontal legend
            x: 0,
            y: -0.15, // Position legend below the chart
            traceorder: 'normal',
            font: {
                size: 10
            }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };

    Plotly.newPlot(targetElementId, dataPlotly, layout, {responsive: true, displayModeBar: false});

}
