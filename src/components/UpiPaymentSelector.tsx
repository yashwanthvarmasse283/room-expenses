import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getUpiVpa, getUpiQrValue } from '@/lib/upiHelper';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Smartphone, QrCode } from 'lucide-react';

const UPI_APPS = [
  { name: 'Google Pay', scheme: 'tez://upi/pay', pkg: 'com.google.android.apps.nbu.paisa.user' },
  { name: 'PhonePe', scheme: 'phonepe://pay', pkg: 'com.phonepe.app' },
  { name: 'Paytm', scheme: 'paytmmp://pay', pkg: 'net.one97.paytm' },
  { name: 'BHIM UPI', scheme: 'upi://pay', pkg: 'in.org.npci.upiapp' },
];

const UPI_ID = '9030726301@ybl';
const UPI_NAME = 'R. Yashwanth Varma';

interface UpiPaymentSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount?: number;
  onPaymentConfirmed: () => void;
  onCancel: () => void;
}

export default function UpiPaymentSelector({ open, onOpenChange, amount, onPaymentConfirmed, onCancel }: UpiPaymentSelectorProps) {
  const { toast } = useToast();
  const [showQr, setShowQr] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);

  const buildUpiUrl = (scheme: string) => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: UPI_NAME,
      tn: 'Room Expenses',
      cu: 'INR',
    });
    if (amount && amount > 0) params.set('am', String(amount));
    return `${scheme}?${params.toString()}`;
  };

  const isAndroid = () => /android/i.test(navigator.userAgent);

  const openApp = (app: typeof UPI_APPS[0]) => {
    if (isAndroid()) {
      const intentUrl = `intent://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&tn=Room%20Expenses&cu=INR${amount ? `&am=${amount}` : ''}#Intent;scheme=upi;package=${app.pkg};end`;
      window.location.href = intentUrl;
    } else {
      window.location.href = buildUpiUrl(app.scheme);
    }
    setPaymentInitiated(true);
  };

  const openGenericUpi = () => {
    const params = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, tn: 'Room Expenses', cu: 'INR' });
    if (amount && amount > 0) params.set('am', String(amount));
    window.location.href = `upi://pay?${params.toString()}`;
    setPaymentInitiated(true);
  };

  const copyVpa = () => {
    navigator.clipboard.writeText(getUpiVpa());
    toast({ title: 'UPI ID Copied', description: getUpiVpa() });
  };

  const handleClose = () => {
    setShowQr(false);
    setPaymentInitiated(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{paymentInitiated ? 'Confirm Payment' : 'Choose Payment Method'}</DialogTitle>
        </DialogHeader>

        {paymentInitiated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Did you complete the payment{amount ? ` of ₹${amount}` : ''}?
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => { onPaymentConfirmed(); handleClose(); }}>
                Payment Done
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { onCancel(); handleClose(); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : showQr ? (
          <div className="space-y-4 text-center">
            <div className="bg-background p-4 rounded-lg border inline-block mx-auto">
              <QRCodeSVG value={getUpiQrValue(amount)} size={180} />
            </div>
            <p className="text-xs text-muted-foreground">Scan with any UPI app to pay{amount ? ` ₹${amount}` : ''}</p>
            <Button variant="outline" size="sm" onClick={() => setShowQr(false)}>Back to options</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {amount && <p className="text-sm text-muted-foreground text-center">Amount: <span className="font-bold text-foreground">₹{amount}</span></p>}
            
            <div className="grid gap-2">
              {UPI_APPS.map(app => (
                <Button key={app.name} variant="outline" className="w-full justify-start h-11" onClick={() => openApp(app)}>
                  <Smartphone className="w-4 h-4 mr-2 text-primary" />
                  {app.name}
                </Button>
              ))}
              <Button variant="outline" className="w-full justify-start h-11" onClick={openGenericUpi}>
                <Smartphone className="w-4 h-4 mr-2 text-muted-foreground" />
                Open Default UPI App
              </Button>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <Button variant="ghost" className="w-full justify-start h-10 text-sm" onClick={() => setShowQr(true)}>
                <QrCode className="w-4 h-4 mr-2" />Show QR Code
              </Button>
              <Button variant="ghost" className="w-full justify-start h-10 text-sm" onClick={copyVpa}>
                <Copy className="w-4 h-4 mr-2" />Copy UPI ID: {getUpiVpa()}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
