export const drawPremiumInvoice = (canvas: HTMLCanvasElement, siteName: string, usersList: any[], label: string) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const width = 900;
  const rowHeight = 48;
  const headerHeight = 220;
  const footerHeight = 80;
  const padding = 50;
  const height = headerHeight + (usersList.length + 1) * rowHeight + footerHeight;
  
  canvas.width = width;
  canvas.height = height;
  
  // Background (Dark premium)
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, '#0a0a0a');
  bgGradient.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);
  
  // Accent border
  ctx.strokeStyle = '#d4af37'; // Gold
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Header Logo/Title
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(siteName.toUpperCase(), width / 2, padding + 40);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillText('PREMIUM GIFT INVOICE', width / 2, padding + 80);
  
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '16px "Segoe UI", Arial, sans-serif';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText(`Date: ${dateStr}  |  Campaign: ${label}`, width / 2, padding + 115);
  
  // Separator
  ctx.beginPath();
  ctx.moveTo(padding, padding + 140);
  ctx.lineTo(width - padding, padding + 140);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();

  const tableTop = padding + headerHeight - 30;
  
  // Table Header
  const thGradient = ctx.createLinearGradient(0, tableTop, 0, tableTop + rowHeight);
  thGradient.addColorStop(0, '#d4af37'); // gold
  thGradient.addColorStop(1, '#aa8621'); // dark gold
  
  ctx.fillStyle = thGradient;
  ctx.fillRect(padding, tableTop, width - padding * 2, rowHeight);
  
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SL.', padding + 20, tableTop + 30);
  ctx.fillText('USER EMAIL', padding + 100, tableTop + 30);
  ctx.fillText('NAME', padding + 400, tableTop + 30);
  ctx.fillText('GIFT DETAILS', padding + 650, tableTop + 30);
  
  // Table Rows
  usersList.forEach((u, i) => {
    const y = tableTop + (i + 1) * rowHeight;
    ctx.fillStyle = i % 2 === 0 ? '#141414' : '#1e1e1e';
    ctx.fillRect(padding, y, width - padding * 2, rowHeight);
    
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, y, width - padding * 2, rowHeight);
    
    ctx.fillStyle = '#eeeeee';
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    
    ctx.fillText((i + 1).toString().padStart(2, '0'), padding + 20, y + 30);
    
    // Masking email for privacy in public invoice
    let emailText = u.email || 'unknown';
    if (emailText.includes('@')) {
       const parts = emailText.split('@');
       const namePart = parts[0].substring(0, Math.min(4, parts[0].length)) + '***';
       emailText = `${namePart}@${parts[1]}`;
    }
    ctx.fillText(emailText.substring(0, 30), padding + 100, y + 30);
    
    let displayName = u.name;
    if (!displayName || displayName.toLowerCase() === 'user' || displayName.trim() === '') {
      displayName = u.email?.split('@')[0] || 'User';
    }
    ctx.fillText(displayName.substring(0, 20) + (displayName.length > 20 ? '...' : ''), padding + 400, y + 30);
    
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('1 Day Premium', padding + 650, y + 30);
  });
  
  // Footer
  const footerTop = tableTop + (usersList.length + 1) * rowHeight + 40;
  ctx.fillStyle = '#666666';
  ctx.font = 'italic 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('This is an auto-generated invoice for community rewards. Thank you for staying with us!', width / 2, footerTop);
  
  // Reset text align
  ctx.textAlign = 'left';
};
