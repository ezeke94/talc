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
} from '@mui/material';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const OperationalDashboard = () => {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerMap, setCenterMap] = useState({});

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
    } catch (err) {
      setMetrics([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2, mt: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Operational Dashboard
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 3 }}>
          Effectiveness and success rate of centers in meeting deadlines.
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={fetchMetrics}>
            Refresh Metrics
          </Button>
        </Box>
        <Table>
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
                <TableRow key={row.centerKey}>
                  <TableCell>{centerMap[row.centerKey] || row.centerKey}</TableCell>
                  <TableCell>{row.totalEvents}</TableCell>
                  <TableCell>{row.percentCompleted}%</TableCell>
                  <TableCell>{row.rescheduleCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
};

export default OperationalDashboard;