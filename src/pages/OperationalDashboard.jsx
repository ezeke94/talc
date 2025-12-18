import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  TableContainer,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
} from '@mui/material';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const OperationalDashboard = () => {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerMap, setCenterMap] = useState({});
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  // Check if user has dashboard access
  const userRole = (currentUser?.role || '').trim().toLowerCase();
  const canViewDashboard = ['admin', 'quality'].includes(userRole);


  // Fetch events and calculate metrics per center name
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Get all centers
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centers = centersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const centerMapObj = Object.fromEntries(centers.map(c => [c.id || c.name, c.name || c.id]));
      setCenterMap(centerMapObj);

      // Get all events
      const eventsSnap = await getDocs(collection(db, 'events'));
      const events = eventsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Collect all center ids/names from events
      const centerKeys = Array.from(
        new Set(
          events.flatMap(ev => Array.isArray(ev.centers) ? ev.centers : [])
        )
      );

      // Calculate metrics for each center
      const centerMetrics = centerKeys.map(centerKey => {
        const centerEvents = events.filter(ev =>
          Array.isArray(ev.centers) && ev.centers.includes(centerKey)
        );
        const totalEvents = centerEvents.length;
        const completedOnTime = centerEvents.filter(ev =>
          ev.status === 'completed'
        ).length;
        const rescheduleCount = centerEvents.filter(ev =>
          Array.isArray(ev.comments) && ev.comments.length > 0
        ).length;
        const percentCompleted = totalEvents === 0
          ? 0
          : Math.round((completedOnTime / totalEvents) * 1000) / 10;
        return {
          centerKey,
          totalEvents,
          percentCompleted,
          rescheduleCount,
        };
      });

      setMetrics(centerMetrics);
    } catch {
      setMetrics([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canViewDashboard) {
      setMetrics([]);
      setLoading(false);
      return;
    }
    fetchMetrics();
  }, [canViewDashboard]);

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2, mt: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Operational Dashboard
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 3 }}>
          Effectiveness and success rate of centers in meeting deadlines.
        </Typography>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" onClick={fetchMetrics}>
            Refresh Metrics
          </Button>
        </Box>

        {/* Chart: percent completed (line) + reschedules (bars) */}
        <Box sx={{ width: '100%', height: 260, mb: 3 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={metrics.map(m => ({
                name: centerMap[m.centerKey] || m.centerKey,
                percent: m.percentCompleted,
                reschedules: m.rescheduleCount,
                total: m.totalEvents,
              }))}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" orientation="left" domain={[0, 100]} unit="%" />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="percent" name="% Completed" stroke="#7BC678" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>

        {/* Mobile-friendly: show cards on small screens, otherwise table */}
        {isSmall ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            {loading ? (
              <Typography>Loading...</Typography>
            ) : metrics.length === 0 ? (
              <Typography>No data available.</Typography>
            ) : (
              metrics.map(row => (
                <Card key={row.centerKey} variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {centerMap[row.centerKey] || row.centerKey}
                    </Typography>
                    <Typography variant="body2">Total events: {row.totalEvents}</Typography>
                    <Typography variant="body2">% completed on time: {row.percentCompleted}%</Typography>
                    <Typography variant="body2">Reschedules: {row.rescheduleCount}</Typography>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Center</TableCell>
                  <TableCell>Total Events</TableCell>
                  <TableCell>% Completed On Time</TableCell>
                  <TableCell>Reschedule Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4}>Loading...</TableCell>
                  </TableRow>
                ) : metrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No data available.</TableCell>
                  </TableRow>
                ) : (
                  metrics.map(row => (
                    <TableRow key={row.centerKey} hover>
                      <TableCell>{centerMap[row.centerKey] || row.centerKey}</TableCell>
                      <TableCell>{row.totalEvents}</TableCell>
                      <TableCell>{row.percentCompleted}%</TableCell>
                      <TableCell>{row.rescheduleCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
};

export default OperationalDashboard;