export const DEFAULT_CURRENCY = 'IQD';

export const normalizeCurrency = (currency) => {
  const normalized = String(currency || DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
};

export const normalizeCurrencyAmount = (value, currency = DEFAULT_CURRENCY) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  const safeCurrency = normalizeCurrency(currency);

  // Legacy UrClinic IQD fees were sometimes entered as "30" to mean 30,000 IQD.
  // Iraqi clinic fees below 1,000 IQD are not meaningful for this workflow, so
  // normalize small positive IQD values to thousands before display/submission.
  if (safeCurrency === 'IQD' && amount > 0 && Math.abs(amount) < 1000) {
    return amount * 1000;
  }

  return amount;
};

export const formatMoney = (value, {
  currency = DEFAULT_CURRENCY,
  locale = 'en-US',
} = {}) => {
  const safeCurrency = normalizeCurrency(currency);
  const amount = normalizeCurrencyAmount(value, safeCurrency);

  if (safeCurrency === 'IQD') {
    return `${Math.round(amount).toLocaleString('en-US')} د.ع`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: safeCurrency === 'IQD' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale)} ${safeCurrency}`;
  }
};
