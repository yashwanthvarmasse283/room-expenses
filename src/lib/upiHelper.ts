const UPI_ID = '9030726301@ybl';
const UPI_NAME = 'R. Yashwanth Varma';
const UPI_TN = 'Room Expenses';

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function triggerUpiPayment(amount?: number) {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    tn: UPI_TN,
    cu: 'INR',
  });
  if (amount && amount > 0) {
    params.set('am', String(amount));
  }

  if (isAndroid()) {
    // Android intent-based deep link targeting GPay
    const intentUrl = `intent://pay?${params.toString()}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    window.location.href = intentUrl;
  } else {
    // iOS / Web fallback
    const upiUrl = `upi://pay?${params.toString()}`;
    window.location.href = upiUrl;
  }
}

export function getUpiVpa(): string {
  return UPI_ID;
}

export function getUpiQrValue(amount?: number): string {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    tn: UPI_TN,
    cu: 'INR',
  });
  if (amount && amount > 0) {
    params.set('am', String(amount));
  }
  return `upi://pay?${params.toString()}`;
}
