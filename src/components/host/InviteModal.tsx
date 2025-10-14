import { X, Copy, QrCode, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getShareUrl, getWhatsAppShareUrl, copyToClipboard } from '../../utils/share';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  roomName: string;
  hostName: string;
}

export default function InviteModal({ isOpen, onClose, code, roomName, hostName }: InviteModalProps) {
  const [showQR, setShowQR] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = () => {
    copyToClipboard(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    copyToClipboard(getShareUrl(code));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsAppShare = () => {
    window.open(getWhatsAppShareUrl(code, roomName), '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-white/20 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white">Invite Guests</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-white mb-2">{roomName}</h3>
            <p className="text-gray-400">Hosted by {hostName}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <p className="text-sm text-gray-400 mb-2 text-center">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-bold text-white tracking-wider">{code}</span>
              <button
                onClick={handleCopyCode}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Copy code"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            {copiedCode && <p className="text-green-400 text-sm mt-2 text-center">Code copied!</p>}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary/20 hover:bg-primary/30 rounded-xl text-primary transition-colors font-semibold"
            >
              <LinkIcon className="w-5 h-5" />
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
            </button>

            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary/20 hover:bg-secondary/30 rounded-xl text-secondary transition-colors font-semibold"
            >
              <QrCode className="w-5 h-5" />
              <span>{showQR ? 'Hide QR Code' : 'Show QR Code'}</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-green-400 transition-colors font-semibold"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Share via WhatsApp</span>
            </button>
          </div>

          {showQR && (
            <div className="flex flex-col items-center pt-4 border-t border-white/10">
              <div className="bg-white p-6 rounded-xl">
                <QRCodeSVG
                  value={`${window.location.origin}/join/${code}`}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm text-gray-400 mt-3">Scan to join the party</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
