import React from 'react';
import { Box, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { chartColors } from '../theme/palette';

export default function MetricsChart({ metrics }) {
  // Prepare data for chart: show completedOnTime % trend per center
  const chartData = metrics.map(m => ({
    center: m.centerId,
    completedOnTime: m.completedOnTime && m.totalEvents ? ((m.completedOnTime / m.totalEvents) * 100) : 0,
    avgDelay: m.avgDelayMinutes || 0,
    reschedules: m.rescheduleCount || 0
  }));

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>Completion Rate Trend by Center</Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
          <XAxis dataKey="center" />
          <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
          <Tooltip formatter={v => `${v.toFixed(1)}%`} />
          <Legend />
          <Line type="monotone" dataKey="completedOnTime" name="Completed On Time (%)" stroke={chartColors.primary} strokeWidth={2} />
          <Line type="monotone" dataKey="avgDelay" name="Avg Delay (min)" stroke={chartColors.secondary} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="reschedules" name="Reschedules" stroke={chartColors.accent} strokeDasharray="2 2" />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
