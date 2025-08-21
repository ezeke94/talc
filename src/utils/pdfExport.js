import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Export events/tasks to PDF for a given week
export function exportEventsToPDF(events, logoUrl, options = {}) {
  // Use landscape so the table fits wider content
  const doc = new jsPDF({ orientation: 'landscape' });

  // Draw logo (rectangular) and heading
  let logoHeight = 0;
  let headingY = 20;
  let headingX = 50;
  if (logoUrl) {
    // Rectangular logo: wider than tall
    doc.addImage(logoUrl, 'PNG', 20, 10, 60, 30);
    logoHeight = 30;
    headingY = 25;
    headingX = 95; // 20 + 60 + spacing
  }

  // Week start can be provided (Date). Default to current week's Monday
  const now = new Date();
  const monday = options.weekStart instanceof Date ? new Date(options.weekStart) : new Date(now);
  if (!(options.weekStart instanceof Date)) {
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  }
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toLocaleDateString();
  const sundayStr = sunday.toLocaleDateString();

  doc.setFontSize(18);
  doc.setTextColor('#292D34');
  const heading = `TALC Management - Events/Tasks for week ${mondayStr} — ${sundayStr}`;
  const pageWidth = doc.internal.pageSize.getWidth();
  const headingLines = doc.splitTextToSize(heading, pageWidth - headingX - 20);
  doc.text(headingLines, headingX, headingY + logoHeight / 2);

  // Columns: Date, Status, Title, Owner, Centers, Tasks
  const columns = [
    { header: 'Date', dataKey: 'date' },
    { header: 'Status', dataKey: 'status' },
    { header: 'Title', dataKey: 'title' },
    { header: 'Owner', dataKey: 'ownerName' },
    { header: 'Centers', dataKey: 'centers' },
    { header: 'Tasks', dataKey: 'tasks' },
  ];

  // Helper to resolve owner name
  const getOwnerName = (ev) => {
    if (ev.ownerType === 'mentor' && ev.mentorMap) return ev.mentorMap[ev.ownerId] || '';
    if (ev.ownerType === 'user' && ev.userMap) {
      const u = ev.userMap[ev.ownerId];
      if (u) return u.name || u.displayName || u.email || '';
    }
    return ev.ownerName || ev.displayName || ev.email || '';
  };

  // Sort events
  const sortedEvents = [...events].sort((a, b) => {
    const da = (typeof a.startDateTime?.toDate === 'function') ? a.startDateTime.toDate() : new Date(a.startDateTime || 0);
    const db = (typeof b.startDateTime?.toDate === 'function') ? b.startDateTime.toDate() : new Date(b.startDateTime || 0);
    return (da.getTime() || 0) - (db.getTime() || 0);
  });

  // Prepare rows
  const rows = sortedEvents.map(ev => {
    let d = null;
    if (ev.startDateTime) {
      if (typeof ev.startDateTime?.toDate === 'function') d = ev.startDateTime.toDate();
      else d = new Date(ev.startDateTime);
    }

    // Date formatting: DD-MM and optional time (12-hour) with non-breaking space before AM/PM
    let dateStr = '';
    if (d && !isNaN(d.getTime())) {
      const dayMonth = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
      if (hasTime) {
        const hr = d.getHours();
        const minute = String(d.getMinutes()).padStart(2, '0');
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const hour12 = hr % 12 === 0 ? 12 : hr % 12;
        const timeStr = `${hour12}:${minute}\u00A0${ampm}`;
        dateStr = `${dayMonth} ${timeStr}`;
      } else {
        dateStr = dayMonth;
      }
    }

    const ownerNameRaw = getOwnerName(ev) || '';
    const ownerName = (typeof ownerNameRaw === 'object') ? (ownerNameRaw.name || ownerNameRaw.displayName || String(ownerNameRaw)) : ownerNameRaw;

    // Centers: prefer options.centerMap when provided
    let centers = '';
    if (Array.isArray(ev.centers)) {
      centers = ev.centers.map(c => {
        if (!c && c !== 0) return '';
        if (typeof c === 'string') return (options.centerMap && options.centerMap[c]) ? options.centerMap[c] : c;
        if (typeof c === 'object') return c.name || c.id || JSON.stringify(c);
        return String(c);
      }).filter(Boolean).join(', ');
    } else if (ev.centers) {
      centers = (typeof ev.centers === 'string') ? ((options.centerMap && options.centerMap[ev.centers]) ? options.centerMap[ev.centers] : ev.centers) : JSON.stringify(ev.centers);
    }

    // Tasks/todos
    let tasksStr = '';
    if (Array.isArray(ev.todos) && ev.todos.length > 0) {
      tasksStr = ev.todos.map(td => {
        if (!td && td !== 0) return '';
        if (typeof td === 'string') return td;
        if (typeof td === 'object') return td.text || td.label || JSON.stringify(td);
        return String(td);
      }).filter(Boolean).join(', ');
    } else if (Array.isArray(ev.tasks)) {
      tasksStr = ev.tasks.map(t => {
        if (!t && t !== 0) return '';
        if (typeof t === 'string') {
          // Map task id -> text when provided in options.taskMap
          return (options.taskMap && (options.taskMap[t] || options.taskMap[String(t)])) ? (options.taskMap[t] || options.taskMap[String(t)]) : t;
        }
        if (typeof t === 'object') {
          // Prefer explicit text/label
          if (t.text) return t.text;
          if (t.label) return t.label;
          // Try mapping by id via options.taskMap
          if (t.id && options.taskMap && (options.taskMap[t.id] || options.taskMap[String(t.id)])) return options.taskMap[t.id] || options.taskMap[String(t.id)];
          // Fallback to id if present, otherwise a compact representation
          if (t.id) return String(t.id);
          return Object.keys(t).length ? (t.text || t.label || JSON.stringify(t)) : '';
        }
        return String(t);
      }).filter(Boolean).join(', ');
    } else if (ev.tasks) {
      if (typeof ev.tasks === 'string') tasksStr = (options.taskMap && (options.taskMap[ev.tasks] || options.taskMap[String(ev.tasks)])) ? (options.taskMap[ev.tasks] || options.taskMap[String(ev.tasks)]) : ev.tasks;
      else if (typeof ev.tasks === 'object' && ev.tasks.id) {
        tasksStr = (options.taskMap && (options.taskMap[ev.tasks.id] || options.taskMap[String(ev.tasks.id)])) ? (options.taskMap[ev.tasks.id] || options.taskMap[String(ev.tasks.id)]) : String(ev.tasks.id);
      } else tasksStr = JSON.stringify(ev.tasks);
    }

    // Title
    let title = '';
    if (ev.title) {
      if (typeof ev.title === 'string') title = ev.title;
      else if (typeof ev.title === 'object') title = ev.title.text || ev.title.name || JSON.stringify(ev.title);
      else title = String(ev.title);
    }

    return {
      date: dateStr,
      status: ev.status || '',
      title,
      ownerName,
      centers,
      tasks: tasksStr,
    };
  });

  // Decide layout: compute usable width and assign column proportions so table fits
  const usableWidth = pageWidth - 20 - 20; // left/right margins
  const colProportions = {
    date: 0.12,
    status: 0.08,
    title: 0.33,
    ownerName: 0.15,
    centers: 0.16,
    tasks: 0.16,
  };
  const columnStyles = {
    date: { cellWidth: usableWidth * colProportions.date, halign: 'center' },
    status: { cellWidth: usableWidth * colProportions.status, halign: 'center' },
    title: { cellWidth: usableWidth * colProportions.title, fontStyle: 'bold', valign: 'top', overflow: 'linebreak' },
    ownerName: { cellWidth: usableWidth * colProportions.ownerName },
    centers: { cellWidth: usableWidth * colProportions.centers },
    tasks: { cellWidth: usableWidth * colProportions.tasks },
  };

  autoTable(doc, {
    columns,
    body: rows,
    startY: 50,
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: '#292D34',
      cellPadding: 3,
      lineColor: '#DDEEDD',
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: '#7BC678',
      textColor: '#292D34',
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: '#DDEEDD' },
    columnStyles,
    margin: { left: 20, right: 20 },
    tableWidth: usableWidth,
    didParseCell: (data) => {
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

  // Build filename
  const pad = n => n.toString().padStart(2, '0');
  const fileMonday = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const fileSunday = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
  doc.save(`TALC_Events_${fileMonday}_to_${fileSunday}.pdf`);
}

