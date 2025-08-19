import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Export events/tasks to PDF for the upcoming week
export function exportEventsToPDF(events, logoUrl) {
  // Use portrait layout for page
  const doc = new jsPDF({ orientation: 'portrait' });

  // Add logo and align heading horizontally with logo
  let logoHeight = 0;
  let headingY = 20;
  let headingX = 50;
  if (logoUrl) {
    doc.addImage(logoUrl, 'PNG', 20, 10, 30, 30);
    logoHeight = 30;
    headingY = 25;
    headingX = 60;
  }

  // Find Monday of current week
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const mondayStr = monday.toLocaleDateString();

  doc.setFontSize(18);
  doc.setTextColor('#292D34'); // charcoal
  // Wrap heading if too long, align with logo
  const heading = `TALC Management - Events/Tasks for week starting ${mondayStr}`;
  const pageWidth = doc.internal.pageSize.getWidth();
  const headingLines = doc.splitTextToSize(heading, pageWidth - headingX - 20);
  doc.text(headingLines, headingX, headingY + logoHeight / 2);

  // Table columns (match UI layout, minus actions)
  const columns = [
    { header: 'Date', dataKey: 'date' },
    { header: 'Title', dataKey: 'title' },
    { header: 'Tasks', dataKey: 'tasks' },
    { header: 'Owner', dataKey: 'ownerName' },
    { header: 'Centers', dataKey: 'centers' },
  ];

  // Table rows
  // Helper to get owner name from users/mentors if available
  // Expects userMap and mentorMap on each event object
  const getOwnerName = (ev) => {
    if (ev.ownerType === 'mentor' && ev.mentorMap) {
      return ev.mentorMap[ev.ownerId] || '';
    }
    if (ev.ownerType === 'user' && ev.userMap) {
      const user = ev.userMap[ev.ownerId];
      if (user) {
        return user.name || user.displayName || user.email || '';
      }
    }
    // Fallbacks
    if (ev.ownerName) return ev.ownerName;
    if (ev.displayName) return ev.displayName;
    if (ev.email) return ev.email;
    return '';
  };

  // Sort events by ascending date
  const sortedEvents = [...events].sort((a, b) => {
    let da = a.startDateTime;
    let db = b.startDateTime;
    if (typeof da?.toDate === 'function') da = da.toDate();
    else da = new Date(da);
    if (typeof db?.toDate === 'function') db = db.toDate();
    else db = new Date(db);
    return (da?.getTime() || 0) - (db?.getTime() || 0);
  });

  const rows = sortedEvents.map(ev => {
    let d = null;
    if (ev.startDateTime) {
      if (typeof ev.startDateTime.toDate === 'function') {
        d = ev.startDateTime.toDate();
      } else {
        d = new Date(ev.startDateTime);
      }
    }
    let ownerName = getOwnerName(ev);
    let centers = Array.isArray(ev.centers) ? ev.centers.map(c => typeof c === 'object' ? c.name || c.id || c : c).join(', ') : (ev.centers || '');
    // Format date as DD-MM
    let dateStr = d && !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
    // For tasks, use todos array if present, else tasks property
    let tasksStr = '';
    if (Array.isArray(ev.todos) && ev.todos.length > 0) {
      tasksStr = ev.todos.map(td => td.text).join(', ');
    } else if (Array.isArray(ev.tasks)) {
      tasksStr = ev.tasks.join(', ');
    } else if (ev.tasks) {
      tasksStr = String(ev.tasks);
    }
    return {
      date: dateStr,
      title: ev.title || '',
      tasks: tasksStr,
      ownerName: getOwnerName(ev),
      centers,
    };
  });

  autoTable(doc, {
    columns,
    body: rows,
    startY: 50,
    styles: {
      font: 'helvetica',
      fontSize: 11,
      textColor: '#292D34', // charcoal
      fillColor: '#EEF5EE', // mintLight
      cellPadding: 3,
      lineColor: '#DDEEDD', // mint
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: '#7BC678', // green
      textColor: '#292D34',
      fontStyle: 'bold',
      fontSize: 12,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: '#DDEEDD', // mint
    },
    columnStyles: {
  date: { cellWidth: 22, halign: 'center' },
  title: { cellWidth: 45, fontStyle: 'bold', valign: 'top', overflow: 'linebreak' },
  tasks: { cellWidth: 50 },
  ownerName: { cellWidth: 38 },
  centers: { cellWidth: 28 },
    },
    margin: { left: 20, right: 20 },
    tableWidth: 'auto',
    didParseCell: (data) => {
      // Always make title bold and wrap
      if (data.column.dataKey === 'title') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.overflow = 'linebreak';
      }
    },
    didDrawPage: (data) => {
      doc.setDrawColor('#DDEEDD');
    },
    pageBreak: 'auto',
  });

  // Use Monday date in filename (YYYY-MM-DD)
  const pad = n => n.toString().padStart(2, '0');
  const fileMonday = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  doc.save(`TALC_Events_${fileMonday}.pdf`);
}
