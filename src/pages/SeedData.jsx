import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, writeBatch, addDoc, getDocs, where, query, doc, updateDoc } from 'firebase/firestore';
// ...existing code...
import { Button, Typography, CircularProgress, Alert, Paper, Stack } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const SeedData = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // --- Sample Data for New Features ---
    // Centers - TALC specific centers
    const sampleCenters = [
        {
            name: "TALC Hephzi",
            location: "Hephzibah",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            name: "PHYSIS",
            location: "Main Campus",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            name: "Harlur",
            location: "Harlur Branch",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            name: "Whitehouse",
            location: "Whitehouse Branch",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        }
    ];

    // Mentors for each center
    const sampleMentors = [
        {
            name: "John Smith",
            center: "TALC Hephzi",
            email: "john.smith@talc.com",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            name: "Sarah Johnson",
            center: "PHYSIS", 
            email: "sarah.johnson@talc.com",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            name: "Michael Brown",
            center: "Harlur",
            email: "michael.brown@talc.com",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            name: "Emily Davis",
            center: "Whitehouse",
            email: "emily.davis@talc.com",
            active: true,
            createdAt: new Date(),
            seedTag: 'seed-demo',
        }
    ];

    const { currentUser } = useAuth();

    // SOPs
    const sampleSops = [
        {
            title: "Event Preparation SOP",
            description: "Steps to prepare for any event.",
            todos: [
                { id: 1, text: "Venue booking" },
                { id: 2, text: "Material readiness" }
            ],
            createdBy: { userId: "user_1", userName: "Admin User" },
            createdAt: new Date(),
            seedTag: 'seed-demo',
        },
        {
            title: "Mentor Meeting SOP",
            description: "Checklist for mentor meetings.",
            todos: [
                { id: 1, text: "Prepare mentee reports" },
                { id: 2, text: "Set agenda" }
            ],
            createdBy: { userId: "mentor_1", userName: "Mentor One" },
            createdAt: new Date(),
            seedTag: 'seed-demo',
        }
    ];

    // (Removed mock Users seeding; AuthContext upserts real users on login)

    // Notifications
    const sampleNotifications = [
        {
            userId: "user_1",
            type: "event_reminder",
            message: "Monthly Center Review is scheduled for tomorrow.",
            sentAt: new Date(),
            read: false,
            seedTag: 'seed-demo',
        },
        {
            userId: "mentor_1",
            type: "event_reschedule",
            message: "Weekly Mentor Meeting has been rescheduled.",
            sentAt: new Date(),
            read: false,
            seedTag: 'seed-demo',
        }
    ];

    // --- Seeding Functions ---
    // Use the existing loading and message state above

    const sampleMetrics = [
        {
            centerId: "PHYSIS",
            totalEvents: 15,
            completedOnTime: 12,
            avgDelayMinutes: 8,
            rescheduleCount: 3,
            seedTag: 'seed-demo',
        },
        {
            centerId: "Whitehouse",
            totalEvents: 10,
            completedOnTime: 7,
            avgDelayMinutes: 15,
            rescheduleCount: 4,
            seedTag: 'seed-demo',
        },
        {
            centerId: "TALC Hephzi",
            totalEvents: 12,
            completedOnTime: 11,
            avgDelayMinutes: 5,
            rescheduleCount: 1,
            seedTag: 'seed-demo',
        },
        {
            centerId: "Harlur",
            totalEvents: 8,
            completedOnTime: 6,
            avgDelayMinutes: 12,
            rescheduleCount: 2,
            seedTag: 'seed-demo',
        }
    ];

    const sampleAuditLogs = [
        {
            userId: "user_1",
            userName: "Admin User",
            action: "create",
            targetType: "event",
            targetId: "event_1",
            details: { title: "Monthly Center Review" },
            timestamp: new Date(),
            seedTag: 'seed-demo',
        },
        {
            userId: "mentor_1",
            userName: "Mentor One",
            action: "reschedule",
            targetType: "event",
            targetId: "event_2",
            details: { newDateTime: new Date(Date.now() + 259200000) },
            timestamp: new Date(),
            seedTag: 'seed-demo',
        }
    ];

    const seedCenters = async () => {
        setLoading(true);
        setMessage("");
        try {
            for (const center of sampleCenters) {
                await addDoc(collection(db, "centers"), center);
            }
            setMessage("Sample centers seeded!");
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const seedMentors = async () => {
        setLoading(true);
        setMessage("");
        try {
            for (const mentor of sampleMentors) {
                await addDoc(collection(db, "mentors"), mentor);
            }
            setMessage("Sample mentors seeded!");
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const seedEvents = async () => {
        setLoading(true);
        setMessage("");
        try {
            // Ensure at least one SOP exists and capture its ID
            let sopId = null;
            const sopsSnap = await getDocs(collection(db, 'sops'));
        if (!sopsSnap.empty) {
                sopId = sopsSnap.docs[0].id;
            } else {
                const newSop = await addDoc(collection(db, 'sops'), {
                    title: 'General Event SOP',
                    description: 'Baseline SOP for seeded events',
                    todos: [
                        { id: 1, text: 'Venue readiness' },
                        { id: 2, text: 'Materials prepared' },
                        { id: 3, text: 'Stakeholders notified' },
                    ],
                    editable: true,
                    createdAt: new Date(),
            seedTag: 'quality10',
                });
                sopId = newSop.id;
            }

            const centersPool = ['TALC Hephzi', 'PHYSIS', 'Harlur', 'Whitehouse'];
            const ownerId = currentUser?.uid || 'owner_current';
            const ownerName = currentUser?.displayName || currentUser?.email || 'Current User';

            const statuses = ['pending', 'in_progress', 'completed', 'pending', 'cancelled'];
            const now = Date.now();

            const makeTodos = (i) => ([
                { id: `${i}-1`, text: 'Plan agenda', completed: i % 3 === 0 },
                { id: `${i}-2`, text: 'Confirm participants', completed: i % 3 === 1 },
                { id: `${i}-3`, text: 'Prepare resources', completed: i % 3 === 2 },
                { id: `${i}-4`, text: 'Log outcomes', completed: false },
            ]);

            const richEvents = Array.from({ length: 10 }).map((_, i) => {
                const start = new Date(now + (i + 1) * 24 * 60 * 60 * 1000 + (i % 5) * 60 * 60 * 1000);
                const end = new Date(start.getTime() + 90 * 60 * 1000);
                const status = statuses[i % statuses.length];
                const centers = [centersPool[i % centersPool.length]];
                const recurring = i % 3 === 0;
                const base = {
                    title: `${centers[0]} — Quality Review ${i + 1}`,
                    description: `High-quality event ${i + 1} focusing on process checks, outcomes, and follow-ups for ${centers[0]}.`,
                    ownerId,
                    ownerType: 'user',
                    centers,
                    startDateTime: start,
                    endDateTime: end,
                    isRecurring: recurring,
                    recurrenceRule: recurring ? 'FREQ=WEEKLY;BYDAY=MO' : null,
                    todos: makeTodos(i),
                    sopId,
                    status,
                    comments: [],
                    createdBy: { userId: ownerId, userName: ownerName },
                    lastModifiedBy: { userId: ownerId, userName: ownerName },
                    notificationSent: false,
                    lastNotificationAt: null,
                    seedTag: 'quality10',
                };
                if (i === 2) {
                    base.comments.push({
                        userId: ownerId,
                        userName: ownerName,
                        comment: 'Rescheduled due to external dependency.',
                        createdAt: new Date(),
                        oldDateTime: start,
                        newDateTime: new Date(start.getTime() + 48 * 60 * 60 * 1000),
                    });
                }
                if (status === 'completed') {
                    // Mark all todos as completed for completed events
                    base.todos = base.todos.map(t => ({ ...t, completed: true }));
                }
                return base;
            });

            for (const ev of richEvents) {
                await addDoc(collection(db, 'events'), ev);
            }
            setMessage('Seeded 10 high-quality events with full details.');
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const seedSops = async () => {
        setLoading(true);
        setMessage("");
        try {
            for (const sop of sampleSops) {
                await addDoc(collection(db, "sops"), sop);
            }
            setMessage("Sample SOPs seeded!");
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Removed seedUsers; user docs are created when users log in

    const seedNotifications = async () => {
        setLoading(true);
        setMessage("");
        try {
            for (const notif of sampleNotifications) {
                await addDoc(collection(db, "notifications"), notif);
            }
            setMessage("Sample notifications seeded!");
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const seedMetrics = async () => {
        setLoading(true);
        setMessage("");
        try {
            for (const metric of sampleMetrics) {
                await addDoc(collection(db, "centerMetrics"), metric);
            }
            setMessage("Sample metrics seeded!");
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const seedAuditLogs = async () => {
        setLoading(true);
        setMessage("");
        try {
            for (const log of sampleAuditLogs) {
                await addDoc(collection(db, "auditLogs"), log);
            }
            setMessage("Sample audit logs seeded!");
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Assign default Firestore KPI forms to all mentors
    // These IDs should correspond to the imported default forms: Intellect and Cultural
    const DEFAULT_FORM_IDS = [
        'skLtVI25pe96cChBkIen', // Intellect
        'z5apuUxnsLyGOAjXpn3F', // Cultural
    ];

    const assignDefaultFormsToAllMentors = async () => {
        setLoading(true);
        setMessage('');
        try {
            const mentorsSnap = await getDocs(collection(db, 'mentors'));
            if (mentorsSnap.empty) {
                setMessage('No mentors found.');
                setLoading(false);
                return;
            }

            const batch = writeBatch(db);
            let updatedCount = 0;

            mentorsSnap.docs.forEach(d => {
                const data = d.data();
                const existing = Array.isArray(data.assignedFormIds) ? data.assignedFormIds : [];
                const merged = Array.from(new Set([ ...existing, ...DEFAULT_FORM_IDS ]));
                // Only write if changed
                if (merged.length !== existing.length || !existing.every((v, i) => merged.includes(v))) {
                    batch.update(d.ref, { assignedFormIds: merged });
                    updatedCount += 1;
                }
            });

            if (updatedCount > 0) {
                await batch.commit();
            }
            setMessage(updatedCount > 0 ? `Assigned default forms to ${updatedCount} mentor(s).` : 'All mentors already have the default forms assigned.');
        } catch (err) {
            console.error(err);
            setMessage(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{p: 3}}>
            <Typography variant="h4" gutterBottom>Seed Firestore Data</Typography>
            <Typography paragraph color="text.secondary">
                Click the buttons below to populate your database with sample data.
                This is for testing only. Before seeding, you should clear the respective collections in Firebase to avoid duplicates.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <Button variant="contained" color="primary" onClick={seedCenters} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed Centers"}
                </Button>
                <Button variant="contained" color="secondary" onClick={seedMentors} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed Mentors"}
                </Button>
                <Button variant="contained" color="success" onClick={seedEvents} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed 10 Quality Events"}
                </Button>
                <Button variant="contained" color="warning" onClick={seedSops} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed SOPs"}
                </Button>
                <Button variant="contained" color="error" onClick={seedNotifications} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed Notifications"}
                </Button>
                <Button variant="outlined" color="primary" onClick={seedMetrics} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed Metrics"}
                </Button>
                <Button variant="outlined" color="secondary" onClick={seedAuditLogs} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Seed Audit Logs"}
                </Button>
                <Button variant="contained" color="info" onClick={assignDefaultFormsToAllMentors} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : 'Assign Default KPI Forms to All Mentors'}
                </Button>
                <Button variant="outlined" color="error" onClick={async () => {
                    setLoading(true);
                    setMessage('');
                    try {
                        // Helper to delete by query in batches
                        const deleteBy = async (coll, field, values) => {
                            if (!values?.length) return 0;
                            // Firestore 'in' supports up to 10 values per query
                            const chunks = [];
                            for (let i = 0; i < values.length; i += 10) chunks.push(values.slice(i, i + 10));
                            let total = 0;
                            for (const chunk of chunks) {
                                const qref = query(collection(db, coll), where(field, 'in', chunk));
                                const snap = await getDocs(qref);
                                const batch = writeBatch(db);
                                snap.docs.forEach(d => batch.delete(d.ref));
                                if (snap.size > 0) await batch.commit();
                                total += snap.size;
                            }
                            return total;
                        };

                        let removed = 0;

                        // Remove any documents tagged as seeded demo data
                        const seedTags = ['seed-demo', 'quality10'];
                        for (const coll of ['centers','mentors','sops','events','notifications','centerMetrics','auditLogs']) {
                            removed += await deleteBy(coll, 'seedTag', seedTags);
                        }

                        setMessage(`Removed ${removed} mock documents.`);
                    } catch (err) {
                        console.error(err);
                        setMessage(`Error: ${err.message}`);
                    } finally {
                        setLoading(false);
                    }
                }} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : 'Remove Mock Data'}
                </Button>
            </Stack>
            {message && (
                <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 2 }}>
                    {message}
                </Alert>
            )}
        </Paper>
    );
};

export default SeedData;