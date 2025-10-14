export function getShareUrl(code: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join/${code}`;
}

export function generateQRCodeUrl(code: string): string {
  const shareUrl = getShareUrl(code);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;
}

export function getWhatsAppShareUrl(code: string, roomName: string): string {
  const shareUrl = getShareUrl(code);
  const message = `Join my party "${roomName}" on VibeBox! ${shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
