# Lessons Learned - Nigerian Crypto Tax Calculator

Project-specific lessons and insights from building this application.

---

## 2026-01-03 - The Orphan Function Anti-pattern

**What happened:**
During security fixes (commit 9371492), we created a comprehensive `validateExchangeRate()` function with proper validation logic:
- Hard limits: ₦100-₦10,000/USD
- Error messaging system
- Input sanitization
- ~30 lines of well-structured code

The function was committed, reviewed, and looked complete. Code review passed.

However, during manual QA testing (local verification), we discovered validation wasn't working:
- Users could enter ₦50 (below minimum) - no error
- Users could enter ₦15,000 (above maximum) - no error
- The validation function existed but was never called

**Root cause:**
No event listeners were attached to the exchange rate input. The function was an "orphan" - it existed in the codebase but had no caller. We wrote the implementation but forgot the integration.

**The fix (commit 0935fb1):**
```javascript
// Added in DOMContentLoaded
const exchangeRateInput = document.getElementById('exchangeRate');
if (exchangeRateInput) {
    exchangeRateInput.addEventListener('blur', () =>
        validateExchangeRate(exchangeRateInput));
    exchangeRateInput.addEventListener('input', () => {
        if (exchangeRateInput.classList.contains('input-error')) {
            clearInputError(exchangeRateInput);
        }
    });
}
```

**Lesson:**
**"Code that exists ≠ Code that runs"**

Creating a function isn't enough - it must be integrated into the application flow:
- Event listeners must be attached
- Functions must be called
- Routes must be registered
- Hooks must be wired up

**Why this matters:**
- Automated tools (linters, type checkers) don't catch this
- Code review can miss integration gaps
- Only manual QA testing reveals orphan code
- Silent failures are the worst kind - no errors, just broken features

**Prevention:**
1. **Test execution, not just existence** - Don't just read code, interact with it
2. **Follow the call chain** - Trace from user action → event → handler → function
3. **Manual QA is mandatory** - Automated tools have blind spots
4. **Integration tests > Unit tests** - Testing in isolation misses wiring issues

**Broader pattern:**
This applies beyond event listeners:
- SQL queries that exist but aren't called by API endpoints
- API routes that exist but aren't registered with the router
- React hooks that exist but aren't used in components
- Validation schemas that exist but aren't applied to forms

**Impact on this project:**
- Bug caught in local testing (not production) ✅
- Added to manual QA checklist in `/ship-checklist`
- Reinforced importance of interactive testing
- Updated CODE_REVIEW.md to document complete fix story

**Promote to main log?** Yes - This is a core principle about testing methodology, not just a project-specific issue.

---
