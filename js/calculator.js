// ============================================
// TAX CALCULATION LOGIC
// ============================================

// Official 2026 tax brackets (Nigeria Tax Act 2025)
const TAX_BRACKETS = [
    { limit: 800000, rate: 0 },       // First ₦800k exempt
    { limit: 3000000, rate: 0.15 },   // ₦800k - ₦3M: 15%
    { limit: 12000000, rate: 0.18 },  // ₦3M - ₦12M: 18%
    { limit: 25000000, rate: 0.21 },  // ₦12M - ₦25M: 21%
    { limit: 50000000, rate: 0.23 },  // ₦25M - ₦50M: 23%
    { limit: Infinity, rate: 0.25 }   // Above ₦50M: 25%
];

// SME exemption thresholds
const SME_GAIN_EXEMPTION = 10000000;   // ₦10M
const SME_REVENUE_EXEMPTION = 150000000; // ₦150M

// Format currency
function formatCurrency(amount) {
    return '₦' + Math.round(amount).toLocaleString('en-NG');
}

// Calculate progressive tax
function calculateProgressiveTax(totalIncome) {
    if (totalIncome <= 0) return { totalTax: 0, breakdown: [] };

    let remainingIncome = totalIncome;
    let totalTax = 0;
    let breakdown = [];
    let previousLimit = 0;

    for (let bracket of TAX_BRACKETS) {
        if (remainingIncome <= 0) break;

        const bracketIncome = Math.min(remainingIncome, bracket.limit - previousLimit);
        const bracketTax = bracketIncome * bracket.rate;

        totalTax += bracketTax;

        if (bracketIncome > 0) {
            breakdown.push({
                range: previousLimit === 0
                    ? `First ${formatCurrency(bracket.limit)}`
                    : `${formatCurrency(previousLimit)} - ${formatCurrency(bracket.limit)}`,
                rate: (bracket.rate * 100).toFixed(0) + '%',
                tax: formatCurrency(bracketTax),
                bracketIncome: bracketIncome,
                rateDecimal: bracket.rate
            });
        }

        remainingIncome -= bracketIncome;
        previousLimit = bracket.limit;
    }

    return { totalTax, breakdown };
}

// ============================================
// LOADING STATES & DEBOUNCING
// ============================================

let calculationTimeout;

// Debounced calculation wrapper
function calculateTaxLiveDebounced() {
    clearTimeout(calculationTimeout);
    showCalculatingState();

    calculationTimeout = setTimeout(() => {
        calculateTaxLive();
        hideCalculatingState();
    }, 300); // 300ms debounce for smooth typing
}

// Show calculating indicator
function showCalculatingState() {
    const heroValue = document.getElementById('heroTaxValue');
    if (heroValue) {
        heroValue.classList.add('calculating');
    }
}

// Hide calculating indicator
function hideCalculatingState() {
    const heroValue = document.getElementById('heroTaxValue');
    if (heroValue) {
        heroValue.classList.remove('calculating');
    }
}

// ============================================
// INPUT VALIDATION & ERROR HANDLING
// ============================================

// Validate numeric input
function validateNumericInput(input) {
    const value = parseFloat(input.value);
    const min = 0;
    const max = 999999999999; // 999 billion max

    // Clear any existing errors first
    clearInputError(input);

    // Skip validation if empty (allowed)
    if (!input.value || input.value.trim() === '') {
        return true;
    }

    // Check if not a number
    if (isNaN(value)) {
        showInputError(input, 'Please enter a valid number');
        return false;
    }

    // Check if negative
    if (value < min) {
        showInputError(input, 'Amount cannot be negative');
        return false;
    }

    // Check if exceeds maximum
    if (value > max) {
        showInputError(input, 'Amount is too large (max: ₦999B)');
        return false;
    }

    return true;
}

// Show inline error message below input
function showInputError(input, message) {
    // Add error class to input
    input.classList.add('input-error');

    // Check if error message already exists
    let errorMsg = input.parentElement.querySelector('.input-error-msg');
    if (!errorMsg) {
        // Create error message element
        errorMsg = document.createElement('div');
        errorMsg.className = 'input-error-msg';
        input.parentElement.appendChild(errorMsg);
    }

    // Set error message text
    errorMsg.textContent = message;

    // Announce to screen readers
    announceToScreenReader(message, 'assertive');
}

// Clear error message from input
function clearInputError(input) {
    input.classList.remove('input-error');
    input.classList.remove('input-warning');

    const errorMsg = input.parentElement.querySelector('.input-error-msg');
    if (errorMsg) {
        errorMsg.remove();
    }

    const warningMsg = input.parentElement.querySelector('.input-warning-msg');
    if (warningMsg) {
        warningMsg.remove();
    }
}

// Show inline warning message below input
function showInputWarning(input, message) {
    // Add warning class to input
    input.classList.add('input-warning');

    // Check if warning message already exists
    let warningMsg = input.parentElement.querySelector('.input-warning-msg');
    if (!warningMsg) {
        // Create warning message element
        warningMsg = document.createElement('div');
        warningMsg.className = 'input-warning-msg';
        input.parentElement.appendChild(warningMsg);
    }

    // Set warning message text
    warningMsg.textContent = message;
}

// Validate exchange rate (warn if unusual)
function validateExchangeRate(input) {
    const value = parseFloat(input.value);
    const typicalMin = 1500;
    const typicalMax = 2000;

    clearInputError(input);

    if (isNaN(value) || value <= 0) {
        showInputError(input, 'Exchange rate must be greater than 0');
        return false;
    }

    // Warn if outside typical range
    if (value < typicalMin || value > typicalMax) {
        showInputWarning(input, `Unusual rate (typical range: ₦${typicalMin}-₦${typicalMax}/USD)`);
    }

    return true;
}

// Create notification toast
function createNotification({ type = 'error', title, message, duration = 5000 }) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    notification.innerHTML = `
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto-dismiss after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);

    // Announce to screen readers
    announceToScreenReader(`${title}: ${message}`, 'assertive');
}

// Announce to screen readers
function announceToScreenReader(message, priority = 'polite') {
    let announcer = document.getElementById('errorAnnouncer');
    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'errorAnnouncer';
        announcer.className = 'sr-only';
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(announcer);
    }

    // Update aria-live priority
    announcer.setAttribute('aria-live', priority);

    // Clear and set message (triggers screen reader)
    announcer.textContent = '';
    setTimeout(() => {
        announcer.textContent = message;
    }, 100);
}

// Live calculation (runs on every input change)
function calculateTaxLive() {
    try {
        // Get exchange rate for USD conversions
        const exchangeRate = parseFloat(document.getElementById('exchangeRate').value) || 1650;

        // Get all income values with currency conversion
        const tradingCurrency = document.getElementById('tradingCurrency').value;
        const tradingValue = parseFloat(document.getElementById('tradingProfit').value) || 0;
        const tradingProfit = tradingCurrency === 'USD' ? tradingValue * exchangeRate : tradingValue;

        // Update conversion display
        if (tradingCurrency === 'USD' && tradingValue > 0) {
            document.getElementById('tradingConversion').style.display = 'block';
            document.getElementById('tradingNGN').textContent = Math.round(tradingProfit).toLocaleString('en-NG');
        } else {
            document.getElementById('tradingConversion').style.display = 'none';
        }

        // Staking Income
        const stakingCurrency = document.getElementById('stakingCurrency').value;
        const stakingValue = parseFloat(document.getElementById('stakingIncome').value) || 0;
        const stakingIncome = stakingCurrency === 'USD' ? stakingValue * exchangeRate : stakingValue;

        if (stakingCurrency === 'USD' && stakingValue > 0) {
            document.getElementById('stakingConversion').style.display = 'block';
            document.getElementById('stakingNGN').textContent = Math.round(stakingIncome).toLocaleString('en-NG');
        } else {
            document.getElementById('stakingConversion').style.display = 'none';
        }

        // Airdrops Income
        const airdropsCurrency = document.getElementById('airdropsCurrency').value;
        const airdropsValue = parseFloat(document.getElementById('airdropsIncome').value) || 0;
        const airdropsIncome = airdropsCurrency === 'USD' ? airdropsValue * exchangeRate : airdropsValue;

        if (airdropsCurrency === 'USD' && airdropsValue > 0) {
            document.getElementById('airdropsConversion').style.display = 'block';
            document.getElementById('airdropsNGN').textContent = Math.round(airdropsIncome).toLocaleString('en-NG');
        } else {
            document.getElementById('airdropsConversion').style.display = 'none';
        }

        // Freelance Income
        const freelanceCurrency = document.getElementById('freelanceCurrency').value;
        const freelanceValue = parseFloat(document.getElementById('freelanceIncome').value) || 0;
        const freelanceIncome = freelanceCurrency === 'USD' ? freelanceValue * exchangeRate : freelanceValue;

        if (freelanceCurrency === 'USD' && freelanceValue > 0) {
            document.getElementById('freelanceConversion').style.display = 'block';
            document.getElementById('freelanceNGN').textContent = Math.round(freelanceIncome).toLocaleString('en-NG');
        } else {
            document.getElementById('freelanceConversion').style.display = 'none';
        }

        // NFT Income
        const nftCurrency = document.getElementById('nftCurrency').value;
        const nftValue = parseFloat(document.getElementById('nftIncome').value) || 0;
        const nftIncome = nftCurrency === 'USD' ? nftValue * exchangeRate : nftValue;

        if (nftCurrency === 'USD' && nftValue > 0) {
            document.getElementById('nftConversion').style.display = 'block';
            document.getElementById('nftNGN').textContent = Math.round(nftIncome).toLocaleString('en-NG');
        } else {
            document.getElementById('nftConversion').style.display = 'none';
        }

        // Calculate gross income
        const grossIncome = tradingProfit + stakingIncome + airdropsIncome + freelanceIncome + nftIncome;

        // Get deductions
        const pensionDeduction = parseFloat(document.getElementById('pensionDeduction').value) || 0;
        const housingDeduction = parseFloat(document.getElementById('housingDeduction').value) || 0;
        const healthDeduction = parseFloat(document.getElementById('healthDeduction').value) || 0;
        const rentPaid = parseFloat(document.getElementById('rentPaid').value) || 0;
        const rentDeduction = Math.min(rentPaid * 0.2, 500000); // 20% of rent, max ₦500k

        // Calculate total deductions
        const totalDeductions = pensionDeduction + housingDeduction + healthDeduction + rentDeduction;

        // Calculate taxable income (after deductions)
        const taxableIncome = Math.max(0, grossIncome - totalDeductions);

        // Calculate tax
        const { totalTax, breakdown } = calculateProgressiveTax(taxableIncome);

        // Calculate take home
        const takeHome = grossIncome - totalTax;

        // Toggle empty state vs results
        const heroEmptyState = document.getElementById('heroEmptyState');
        const heroResultContent = document.getElementById('heroResultContent');

        if (grossIncome > 0) {
            // Show results, hide empty state
            if (heroEmptyState) heroEmptyState.style.display = 'none';
            if (heroResultContent) heroResultContent.style.display = 'block';
        } else {
            // Show empty state, hide results
            if (heroEmptyState) heroEmptyState.style.display = 'block';
            if (heroResultContent) heroResultContent.style.display = 'none';
        }

        // Update hero metric
        document.getElementById('heroTaxValue').textContent = formatCurrency(totalTax);

        // Update quick stats
        document.getElementById('statGrossIncome').textContent = formatCurrency(grossIncome);
        document.getElementById('statTaxableIncome').textContent = formatCurrency(taxableIncome);
        document.getElementById('statTakeHome').textContent = formatCurrency(takeHome);

        // Render bracket visualizer
        renderBracketVisualizer(taxableIncome, breakdown);

        // Generate and display tips
        const tips = generateOptimizationTips(grossIncome, {
            trading: tradingProfit,
            staking: stakingIncome,
            airdrops: airdropsIncome,
            freelance: freelanceIncome,
            nft: nftIncome
        }, totalDeductions, pensionDeduction);

        if (tips.length > 0) {
            document.getElementById('tipsSection').style.display = 'block';
            document.getElementById('tipsGrid').innerHTML = tips.map(tip => `
                <div class="tip-card">
                    <div class="tip-badge">Tip</div>
                    <div class="tip-content">${tip}</div>
                </div>
            `).join('');
        } else {
            document.getElementById('tipsSection').style.display = 'none';
        }

        // Show save prompt after first successful calculation (with delay)
        // Only if user has entered some income (grossIncome > 0)
        if (grossIncome > 0) {
            setTimeout(() => {
                showSavePrompt();
            }, 2000); // 2 second delay after calculation
        }

    } catch (error) {
        console.error('Tax calculation error:', error);
    }
}

// Render tax bracket visualizer
function renderBracketVisualizer(taxableIncome, breakdown) {
    const visualizer = document.getElementById('bracketVisualizer');
    const barsContainer = document.getElementById('bracketBars');

    if (taxableIncome <= 0 || breakdown.length === 0) {
        // Show empty state instead of hiding
        visualizer.style.display = 'block';
        barsContainer.innerHTML = `
            <div class="bracket-empty-state">
                <p class="text-base text-gray-700 mb-2" style="font-weight: 600; color: var(--gray-900); margin-bottom: var(--space-3);">
                    Your tax breakdown will appear here once you enter income.
                </p>
                <p class="text-sm text-gray-500" style="color: var(--gray-600); font-size: var(--text-sm); line-height: 1.6;">
                    Nigeria uses progressive tax brackets - you'll see exactly
                    how your income is taxed at each level.
                </p>
            </div>
        `;
        return;
    }

    visualizer.style.display = 'block';
    barsContainer.innerHTML = '';

    let remainingIncome = taxableIncome;
    let previousLimit = 0;
    const maxBracketWidth = taxableIncome;

    for (let i = 0; i < TAX_BRACKETS.length; i++) {
        const bracket = TAX_BRACKETS[i];

        if (remainingIncome <= 0) break;

        const bracketIncome = Math.min(remainingIncome, bracket.limit - previousLimit);
        const bracketTax = bracketIncome * bracket.rate;
        const widthPercentage = (bracketIncome / maxBracketWidth) * 100;

        // Determine bracket label
        let rangeLabel;
        if (bracket.limit === 800000) {
            rangeLabel = 'First ₦800k';
        } else if (bracket.limit === Infinity) {
            rangeLabel = `Above ₦${(previousLimit / 1000000).toFixed(0)}M`;
        } else {
            rangeLabel = `₦${(previousLimit / 1000000).toFixed(previousLimit >= 1000000 ? 0 : 1)}M - ₦${(bracket.limit / 1000000).toFixed(0)}M`;
        }

        // Only render if there's income in this bracket
        if (bracketIncome > 0) {
            const barHTML = `
                <div class="bracket-bar-container">
                    <div class="bracket-bar-header">
                        <span class="bracket-bar-label">${rangeLabel}</span>
                        <span class="bracket-bar-rate">${(bracket.rate * 100).toFixed(0)}% rate</span>
                    </div>
                    <div class="bracket-bar-track">
                        <div class="bracket-bar-fill bracket-${(bracket.rate * 100).toFixed(0)}"
                             style="width: ${widthPercentage}%">
                            ${bracketIncome >= 100000 ? formatCurrency(bracketTax) : ''}
                        </div>
                    </div>
                </div>
            `;

            barsContainer.innerHTML += barHTML;
        }

        remainingIncome -= bracketIncome;
        previousLimit = bracket.limit;
    }
}

// Generate optimization tips
function generateOptimizationTips(totalIncome, incomeData, totalDeductions, pensionDeduction) {
    const tips = [];

    // SME exemption tip (if under threshold)
    if (totalIncome > 0 && totalIncome < SME_GAIN_EXEMPTION) {
        const { totalTax } = calculateProgressiveTax(totalIncome);
        if (totalTax > 0) {
            tips.push(
                `✓ You may qualify for small player exemption and save ${formatCurrency(totalTax)} in taxes if your sale proceeds are also under ₦150M. Consult a tax professional to confirm eligibility.`
            );
        }
    }

    // Pension deduction tip
    if (pensionDeduction < 2000000 && totalIncome > 5000000) {
        const potentialSavings = (2000000 - pensionDeduction) * 0.21; // Estimate at 21% bracket
        tips.push(
            `💰 Increasing pension contributions to ₦2M could save you approximately ${formatCurrency(potentialSavings)} in taxes. 100% deductible with no limit!`
        );
    }

    // High income tax planning
    if (totalIncome > SME_GAIN_EXEMPTION) {
        tips.push(
            '💼 For gains above ₦10M, professional tax planning becomes important. Consider consulting a crypto-savvy tax advisor for optimization strategies.'
        );
    }

    // Record keeping (always show)
    tips.push(
        '📝 Keep detailed records of all crypto transactions, including dates, amounts, and sources. Essential for tax filing and audits.'
    );

    return tips.slice(0, 4); // Show max 4 tips
}

// ============================================
// EDUCATIONAL FEATURES
// ============================================

// Did You Know? Facts System
const taxFacts = [
    'The first ₦800,000 you earn is completely <strong>TAX-FREE</strong> under Nigeria\'s 2026 tax law!',
    'Pension contributions are <strong>100% deductible</strong> with no limit - save up to ₦500,000 in taxes!',
    'Progressive tax means only the income <strong>above each threshold</strong> is taxed at the higher rate.',
    'Small traders with gains under ₦10M and proceeds under ₦150M pay <strong>₦0 tax</strong> (SME exemption).',
    'The rent you pay can reduce your taxes! <strong>20% of rent</strong> is deductible, capped at ₦500,000.',
    'Health insurance premiums are <strong>100% tax deductible</strong> - your HMO can save you money!',
    'At ₦10M income, you\'re in the 18% bracket, but your effective rate is only <strong>16%</strong>!',
    'Keep detailed records of all crypto transactions - <strong>dates, amounts, and sources</strong> are essential.'
];

let currentFactIndex = 0;
let factRotationInterval;

function initializeFacts() {
    const factNav = document.getElementById('factNav');
    factNav.innerHTML = taxFacts.map((_, index) =>
        `<span class="fact-dot ${index === 0 ? 'active' : ''}" onclick="showFact(${index})"></span>`
    ).join('');

    startFactRotation();
}

function showFact(index) {
    currentFactIndex = index;
    document.getElementById('factsContent').innerHTML = taxFacts[index];

    // Update navigation dots
    document.querySelectorAll('.fact-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });

    // Reset rotation timer
    stopFactRotation();
    startFactRotation();
}

function startFactRotation() {
    factRotationInterval = setInterval(() => {
        currentFactIndex = (currentFactIndex + 1) % taxFacts.length;
        showFact(currentFactIndex);
    }, 5000); // Rotate every 5 seconds
}

function stopFactRotation() {
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
    }
}

// ============================================
// UI INTERACTION
// ============================================

// Toggle collapsible sections
function toggleSection(sectionName) {
    const header = document.querySelector(`#${sectionName}Content`).previousElementSibling;
    const content = document.getElementById(`${sectionName}Content`);
    const isExpanded = header.getAttribute('aria-expanded') === 'true';

    header.setAttribute('aria-expanded', !isExpanded);
    content.classList.toggle('expanded');
}

// Toggle FAQ items
function toggleFAQ(index) {
    const question = document.querySelectorAll('.faq-question')[index];
    const answer = document.getElementById(`faq${index}`);
    const isExpanded = question.getAttribute('aria-expanded') === 'true';

    question.setAttribute('aria-expanded', !isExpanded);
    answer.classList.toggle('expanded');
}

// ============================================
// TOOLTIP SYSTEM
// ============================================

// Tooltip content data
const tooltipData = {
    // Income types
    trading: {
        header: 'Trading Profit',
        body: 'Net gains from buying and selling cryptocurrencies. Calculate this as: (Sale price - Purchase price - Trading fees) for all trades during the year.',
        example: 'Bought 1 BTC at ₦20M, sold at ₦30M → ₦10M trading profit'
    },
    staking: {
        header: 'Staking Income',
        body: 'Rewards earned from staking cryptocurrencies, yield farming, or providing liquidity to DeFi protocols. Taxed as income at the fair market value when received.',
        example: '100 ETH staked earning 5% APY → ₦2M staking income (at current rates)'
    },
    airdrops: {
        header: 'Airdrops Income',
        body: 'Free tokens received from projects, forks, or promotional campaigns. Taxed as income at fair market value when you receive control of the tokens.',
        example: 'Received 1,000 tokens worth ₦500 each → ₦500,000 airdrop income'
    },
    freelance: {
        header: 'Freelance Income',
        body: 'Cryptocurrency payments received for services rendered, consulting, or contract work. Taxed as professional income at the value when received.',
        example: 'Received 0.5 BTC for consulting (worth ₦15M) → ₦15M freelance income'
    },
    nft: {
        header: 'NFT Income',
        body: 'Profits from selling NFTs (non-fungible tokens). Calculate as: Sale price - Original purchase price - Platform fees. Royalties from NFT sales also count as income.',
        example: 'Sold NFT for ₦5M (bought for ₦1M, ₦100k fees) → ₦3.9M NFT income'
    },

    // Deductions
    pension: {
        header: 'Pension Contributions',
        body: 'Contributions to approved Nigerian pension schemes (PFAs regulated by PenCom) are 100% tax deductible with no upper limit under the 2026 Tax Act.',
        example: '₦2,000,000 pension contribution → Tax savings up to ₦500,000'
    },
    housing: {
        header: 'NHF/Housing Contributions',
        body: 'Contributions to the National Housing Fund or approved housing schemes are 100% tax deductible. This includes mandatory NHF contributions and voluntary housing savings.',
        example: '₦500,000 NHF contribution → Tax savings up to ₦125,000'
    },
    health: {
        header: 'Health Insurance Premiums',
        body: 'Premiums paid for health insurance (for yourself, spouse, or children) are 100% tax deductible under Nigerian tax law.',
        example: '₦300,000 health insurance premium → Tax savings up to ₦75,000'
    },
    rent: {
        header: 'Annual Rent Relief',
        body: '20% of annual rent paid is tax deductible, with a maximum relief of ₦500,000. This applies to rent paid for your primary residence in Nigeria.',
        example: '₦2.5M annual rent → ₦500,000 deduction (20% = ₦500k, capped at max)'
    },

    // Result metrics
    grossIncome: {
        header: 'Gross Income',
        body: 'Total cryptocurrency income from all sources before any deductions. This is the sum of trading profits, staking rewards, airdrops, freelance payments, and NFT sales.',
        example: '₦5M trading + ₦2M staking + ₦1M NFT = ₦8M gross income'
    },
    taxableIncome: {
        header: 'Taxable Income',
        body: 'Your gross income minus all eligible deductions (pension, housing, health insurance, rent relief). This is the amount used to calculate your tax liability.',
        example: '₦8M gross - ₦2M deductions = ₦6M taxable income'
    },
    taxOwed: {
        header: 'Tax Owed',
        body: 'Total tax calculated using Nigeria\'s progressive tax brackets. The first ₦800k is exempt, then rates increase from 15% to 25% based on income levels.',
        example: '₦6M taxable income → ₦870,000 tax (progressive rates applied)'
    },
    takeHome: {
        header: 'Take Home Amount',
        body: 'What remains after paying taxes. Calculated as: Gross income - Tax owed. This is the actual amount you keep after tax obligations.',
        example: '₦8M gross - ₦1.2M tax = ₦6.8M take home'
    },

    // SME exemption
    smeExemption: {
        header: 'Small Player Exemption',
        body: 'If your crypto gains are under ₦10M AND total crypto proceeds are under ₦150M in a year, you may qualify for full tax exemption under the small player threshold.',
        example: '₦8M gains + ₦50M proceeds → Qualifies (₦0 tax owed)'
    }
};

let activeTooltip = null;

function toggleTooltip(event, id) {
    event.stopPropagation();

    // Close existing tooltip if clicking same trigger
    if (activeTooltip && activeTooltip.dataset.tooltipId === id) {
        closeTooltip();
        return;
    }

    // Close any existing tooltip
    closeTooltip();

    // Get tooltip data
    const data = tooltipData[id];
    if (!data) return;

    // Determine if mobile (< 768px)
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        showMobileTooltip(data, id);
    } else {
        showDesktopTooltip(event, data, id);
    }
}

function showMobileTooltip(data, id) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'tooltip-overlay';
    overlay.dataset.tooltipId = id;
    overlay.onclick = closeTooltip;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'tooltip-modal';
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <div class="tooltip-modal-header">
            <h3 class="tooltip-modal-title">${data.header}</h3>
            <button class="tooltip-close" onclick="closeTooltip()" aria-label="Close tooltip">×</button>
        </div>
        <div class="tooltip-modal-body">
            <p class="tooltip-body-text">${data.body}</p>
            ${data.example ? `<p class="tooltip-example"><strong>Example:</strong> ${data.example}</p>` : ''}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeTooltip = overlay;

    // Animate in
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
}

function showDesktopTooltip(event, data, id) {
    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-popup';
    tooltip.dataset.tooltipId = id;

    tooltip.innerHTML = `
        <div class="tooltip-header">${data.header}</div>
        <div class="tooltip-body">${data.body}</div>
        ${data.example ? `<div class="tooltip-example"><strong>Example:</strong> ${data.example}</div>` : ''}
    `;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Position tooltip
    const tooltipRect = tooltip.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // Position horizontally (centered on trigger, but keep within viewport)
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));

    // Position vertically (prefer below, but go above if not enough space)
    let top;
    if (spaceBelow > tooltipRect.height + 8 || spaceBelow > spaceAbove) {
        top = rect.bottom + 8;
        tooltip.classList.add('tooltip-below');
    } else {
        top = rect.top - tooltipRect.height - 8;
        tooltip.classList.add('tooltip-above');
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Animate in
    requestAnimationFrame(() => {
        tooltip.classList.add('active');
    });

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', closeTooltip);
    }, 0);
}

function closeTooltip() {
    if (!activeTooltip) return;

    activeTooltip.classList.remove('active');
    setTimeout(() => {
        if (activeTooltip && activeTooltip.parentNode) {
            activeTooltip.parentNode.removeChild(activeTooltip);
        }
        activeTooltip = null;
    }, 200);

    document.removeEventListener('click', closeTooltip);
}

// Close tooltip on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTooltip();
    }
});

// ============================================
// INITIALIZATION
// ============================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeFacts();
    calculateTaxLive(); // Initial calculation

    // On desktop, expand all sections by default
    if (window.innerWidth >= 768) {
        document.querySelectorAll('.section-content').forEach(content => {
            content.classList.add('expanded');
        });
    }
});

// ============================================
// EMAIL SAVING FEATURE (OPTIONAL, NO FRICTION)
// ============================================

// Check if user has dismissed save prompt before
function hasDismissedSavePrompt() {
    return localStorage.getItem('savePromptDismissed') === 'true';
}

// Show save prompt after calculation (if not dismissed)
function showSavePrompt() {
    if (!hasDismissedSavePrompt()) {
        const prompt = document.getElementById('savePrompt');
        if (prompt) {
            prompt.style.display = 'block';
            // Smooth scroll to prompt
            prompt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// Dismiss save prompt
function dismissSavePrompt() {
    const prompt = document.getElementById('savePrompt');
    if (prompt) {
        prompt.style.display = 'none';
    }
    // Remember dismissal (don't annoy user)
    localStorage.setItem('savePromptDismissed', 'true');
}

// Email calculation link to user
function emailCalculation() {
    const emailInput = document.getElementById('saveEmail');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address');
        return;
    }

    // Get current URL with all calculation data (already has URL params)
    const calculationURL = window.location.href;

    // Create mailto link
    const subject = encodeURIComponent('Your Nigerian Crypto Tax Calculation');
    const body = encodeURIComponent(
        `Here's your saved tax calculation:\n\n${calculationURL}\n\n` +
        `Access this link anytime to view your results.\n\n` +
        `Nigerian Crypto Tax Calculator\n` +
        `https://nigerian-crypto-tax-calc.netlify.app`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

    // Hide prompt after sending
    dismissSavePrompt();
}

// Copy calculation URL to clipboard
function copyCalculationURL(event) {
    event.preventDefault();

    const url = window.location.href;

    // Modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            alert('✅ Link copied to clipboard!');
            dismissSavePrompt();
        }).catch(() => {
            // Fallback for clipboard errors
            fallbackCopyURL(url);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyURL(url);
    }
}

// Fallback copy method for older browsers
function fallbackCopyURL(url) {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand('copy');
        alert('✅ Link copied to clipboard!');
        dismissSavePrompt();
    } catch (err) {
        // Ultimate fallback: show URL in prompt
        prompt('Copy this link:', url);
    }

    document.body.removeChild(textArea);
}
