import React, { useState, useCallback } from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
    AppBar, 
    Toolbar, 
    Typography, 
    Button, 
    Container, 
    Box,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemText,
    useTheme,
    useMediaQuery,
    Avatar,
    Menu,
    MenuItem,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    Collapse,
    ListItemIcon,
    ListItemButton
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import ProfileSettingsDialog from './ProfileSettingsDialog';
import NotificationPrompt from './NotificationPrompt';
import AddToHomeScreenPrompt from './AddToHomeScreenPrompt';

const Layout = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const { currentUser } = useAuth();
    const [profileMenuEl, setProfileMenuEl] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    
    // Desktop dropdown states
    const [dashboardMenuEl, setDashboardMenuEl] = useState(null);
    const [appSetupMenuEl, setAppSetupMenuEl] = useState(null);
    
    // Mobile collapse states
    const [mobileExpandedSections, setMobileExpandedSections] = useState({
        dashboards: false,
        appSetup: false
    });

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const openProfileMenu = (e) => setProfileMenuEl(e.currentTarget);
    const closeProfileMenu = () => setProfileMenuEl(null);
    const openProfileSettings = () => {
        closeProfileMenu();
        setShowProfile(true);
    };
    
    // Desktop dropdown handlers
    const openDashboardMenu = (e) => setDashboardMenuEl(e.currentTarget);
    const closeDashboardMenu = () => setDashboardMenuEl(null);
    const openAppSetupMenu = (e) => setAppSetupMenuEl(e.currentTarget);
    const closeAppSetupMenu = () => setAppSetupMenuEl(null);
    
    // Mobile section toggle
    const toggleMobileSection = (section) => {
        setMobileExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };
    
    const handleNavigateToNotificationSettings = () => {
        // Open the profile settings dialog instead of navigating to a page
        setShowProfile(true);
    };
    const logoutFromMenu = async () => {
        closeProfileMenu();
        await handleLogout();
    };

    // Only log role in development to avoid noisy repeated logs in production
    if (import.meta.env.DEV) {
        console.debug('Current user role:', currentUser && currentUser.role);
    }
    // Be resilient if role temporarily drops from context; fall back to cached profile
    const roleFromCache = (() => {
        try { return JSON.parse(localStorage.getItem('talc_user_profile') || 'null')?.role; } catch { return undefined; }
    })();
    const roleRaw = (currentUser && currentUser.role) || roleFromCache || '';
    const normalizedRole = (typeof roleRaw === 'string') ? roleRaw.trim().toLowerCase() : '';
    const showUserManagement = ['admin', 'quality'].includes(normalizedRole);
    
    // Organized menu structure
    const hardReload = useCallback(() => {
        const performReload = () => {
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('r', String(Date.now()));
                window.location.replace(url.toString());
            } catch (err) {
                const { href, search, hash } = window.location;
                const base = href.split('#')[0].split('?')[0];
                const sep = search ? '&' : '?';
                window.location.replace(`${base}${search}${sep}r=${Date.now()}${hash || ''}`);
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations()
                .then((regs) => {
                    const waiting = regs.find(reg => reg && reg.waiting)?.waiting;
                    if (waiting) {
                        const onStateChange = (event) => {
                            if (event.target?.state === 'activated') {
                                performReload();
                            }
                        };
                        waiting.addEventListener('statechange', onStateChange, { once: true });
                        waiting.postMessage({ type: 'SKIP_WAITING' });
                        setTimeout(performReload, 500);
                    } else {
                        performReload();
                    }
                })
                .catch(() => {
                    performReload();
                });
        } else {
            performReload();
        }
    }, []);

    const dashboardItems = [
        { text: 'KPI Dashboard', path: '/kpi-dashboard' },
        { text: 'Operational', path: '/operational-dashboard' }
    ];
    
    const appSetupItems = [
        { text: 'SOPs', path: '/sop-management' },
        ...(showUserManagement ? [
            { text: 'Forms', path: '/form-management' },
            { text: 'Users', path: '/user-management' }
        ] : []),
        { text: 'Reload Application', action: hardReload, icon: <RefreshIcon fontSize="small" /> }
    ];
    
    const standaloneItems = [
        { text: 'Calendar', path: '/calendar' },
        { text: 'Record KPIs', path: '/mentors' }
    ];

    const drawer = (
        <List>
            {/* Standalone items */}
            {standaloneItems.map((item) => (
                <ListItem 
                    key={item.text} 
                    component={RouterLink} 
                    to={item.path}
                    onClick={handleDrawerToggle}
                    sx={{ borderRadius: 1, mx: 1 }}
                >
                    <ListItemText primary={item.text} />
                </ListItem>
            ))}
            
            {/* Dashboards section */}
            <ListItem 
                onClick={() => toggleMobileSection('dashboards')}
                sx={{ borderRadius: 1, mx: 1, cursor: 'pointer' }}
            >
                <ListItemIcon>
                    <DashboardIcon />
                </ListItemIcon>
                <ListItemText primary="Dashboards" />
                {mobileExpandedSections.dashboards ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItem>
            <Collapse in={mobileExpandedSections.dashboards} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {dashboardItems.map((item) => (
                        <ListItem
                            key={item.text}
                            component={RouterLink}
                            to={item.path}
                            onClick={handleDrawerToggle}
                            sx={{ pl: 4, borderRadius: 1, mx: 1 }}
                        >
                            <ListItemText primary={item.text} />
                        </ListItem>
                    ))}
                </List>
            </Collapse>
            
            {/* App Setup section (only show if user has access to any setup items) */}
            {appSetupItems.length > 0 && (
                <>
                    <ListItem 
                        onClick={() => toggleMobileSection('appSetup')}
                        sx={{ borderRadius: 1, mx: 1, cursor: 'pointer' }}
                    >
                        <ListItemIcon>
                            <SettingsIcon />
                        </ListItemIcon>
                        <ListItemText primary="App Setup" />
                        {mobileExpandedSections.appSetup ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItem>
                    <Collapse in={mobileExpandedSections.appSetup} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {appSetupItems.map((item) => (
                                <ListItem key={item.text} disablePadding sx={{ mx: 1, borderRadius: 1 }}>
                                    <ListItemButton
                                        {...(item.path ? { component: RouterLink, to: item.path } : { component: 'button' })}
                                        onClick={() => {
                                            handleDrawerToggle();
                                            if (!item.path && typeof item.action === 'function') {
                                                item.action();
                                            }
                                        }}
                                        sx={{ pl: item.icon ? 3 : 4, borderRadius: 1 }}
                                    >
                                        {item.icon && (
                                            <ListItemIcon sx={{ minWidth: 32 }}>
                                                {item.icon}
                                            </ListItemIcon>
                                        )}
                                        <ListItemText primary={item.text} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Collapse>
                </>
            )}
        </List>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar position="fixed" elevation={1} sx={{
                bgcolor: 'background.default',
                color: 'text.primary',
                borderRadius: '0 0 12px 12px',
                borderBottom: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 6px 24px rgba(123,198,120,0.18)'
            }}>
                <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: 2 }}>
                    <Box 
                        component="img"
                        src={logo} 
                        alt="Logo" 
                        sx={{ 
                            height: { xs: 32, sm: 40 }, 
                            mr: 2, 
                            cursor: 'pointer' 
                        }}
                        onClick={() => navigate('/')}
                    />
            <Typography 
                        variant="h6" 
                        component="div" 
                        sx={{ 
                            flexGrow: 1,
                fontSize: { xs: '1.1rem', sm: '1.25rem' }
                        }}
                    >
                        TALC Management
                    </Typography>
                    {!isMobile && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {/* Standalone menu items */}
                            {standaloneItems.map((item) => (
                                <Button 
                                    key={item.text}
                                    color="inherit" 
                                    component={RouterLink} 
                                    to={item.path}
                                    sx={{ borderRadius: 2, fontWeight: 500, '&:hover': { bgcolor: 'rgba(123,198,120,0.15)' } }}
                                >
                                    {item.text}
                                </Button>
                            ))}
                            
                            {/* Dashboards dropdown */}
                            <Button
                                color="inherit"
                                onClick={openDashboardMenu}
                                endIcon={<ExpandMoreIcon />}
                                sx={{ borderRadius: 2, fontWeight: 500, '&:hover': { bgcolor: 'rgba(123,198,120,0.15)' } }}
                            >
                                Dashboards
                            </Button>
                            <Menu
                                anchorEl={dashboardMenuEl}
                                open={Boolean(dashboardMenuEl)}
                                onClose={closeDashboardMenu}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                            >
                                {dashboardItems.map((item) => (
                                    <MenuItem
                                        key={item.text}
                                        component={RouterLink}
                                        to={item.path}
                                        onClick={closeDashboardMenu}
                                    >
                                        {item.text}
                                    </MenuItem>
                                ))}
                            </Menu>
                            
                            {/* App Setup dropdown (only show if user has access to setup items) */}
                            {appSetupItems.length > 0 && (
                                <>
                                    <Button
                                        color="inherit"
                                        onClick={openAppSetupMenu}
                                        endIcon={<ExpandMoreIcon />}
                                        sx={{ borderRadius: 2, fontWeight: 500, '&:hover': { bgcolor: 'rgba(123,198,120,0.15)' } }}
                                    >
                                        App Setup
                                    </Button>
                                    <Menu
                                        anchorEl={appSetupMenuEl}
                                        open={Boolean(appSetupMenuEl)}
                                        onClose={closeAppSetupMenu}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                    >
                                        {appSetupItems.map((item) => (
                                            <MenuItem
                                                key={item.text}
                                                {...(item.path ? { component: RouterLink, to: item.path } : {})}
                                                onClick={() => {
                                                    closeAppSetupMenu();
                                                    if (!item.path && typeof item.action === 'function') {
                                                        item.action();
                                                    }
                                                }}
                                            >
                                                {item.icon && (
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        {item.icon}
                                                    </ListItemIcon>
                                                )}
                                                {item.text}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </>
                            )}
                            
                            {currentUser && (
                                <>
                                    <Tooltip title={currentUser.displayName || currentUser.email || 'Profile'}>
                                        <IconButton color="inherit" onClick={openProfileMenu} sx={{ p: 0.5 }}>
                                            <Avatar 
                                                src={currentUser.photoURL || undefined} 
                                                alt={currentUser.displayName || currentUser.email || 'User'}
                                                sx={{ width: 36, height: 36 }}
                                            >
                                                {(currentUser.displayName || currentUser.email || 'U')
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </Avatar>
                                        </IconButton>
                                    </Tooltip>
                                    <Menu
                                        anchorEl={profileMenuEl}
                                        open={Boolean(profileMenuEl)}
                                        onClose={closeProfileMenu}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    >
                                        <MenuItem onClick={openProfileSettings}>Profile Settings</MenuItem>
                                        <MenuItem onClick={logoutFromMenu}>Logout</MenuItem>
                                    </Menu>
                                </>
                            )}
                        </Box>
                    )}
                    {isMobile && (
                        <IconButton
                            color="inherit"
                            edge="end"
                            onClick={handleDrawerToggle}
                            sx={{ ml: 2 }}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}
                    {isMobile && currentUser && (
                        <>
                            <Tooltip title={currentUser.displayName || currentUser.email || 'Profile'}>
                                <IconButton color="inherit" onClick={openProfileMenu} sx={{ ml: 1, p: 0.5 }}>
                                    <Avatar 
                                        src={currentUser.photoURL || undefined} 
                                        alt={currentUser.displayName || currentUser.email || 'User'}
                                        sx={{ width: 32, height: 32 }}
                                    >
                                        {(currentUser.displayName || currentUser.email || 'U')
                                            .charAt(0)
                                            .toUpperCase()}
                                    </Avatar>
                                </IconButton>
                            </Tooltip>
                            <Menu
                                anchorEl={profileMenuEl}
                                open={Boolean(profileMenuEl)}
                                onClose={closeProfileMenu}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                                <MenuItem onClick={openProfileSettings}>Profile Settings</MenuItem>
                                <MenuItem onClick={logoutFromMenu}>Logout</MenuItem>
                            </Menu>
                        </>
                    )}
                </Toolbar>
            </AppBar>

            <Drawer
                variant="temporary"
                anchor="right"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': {
                        width: 240,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '100vh',
                        borderTopRightRadius: 12,
                        borderBottomRightRadius: 12
                    },
                }}
            >
                <Box sx={{ width: '100%' }}>{drawer}</Box>
            </Drawer>

            <Container 
                component="main" 
                maxWidth="xl"
                sx={{ 
                    mt: { xs: 8, sm: 9 }, 
                    p: { xs: 2, sm: 3 }, 
                    width: '100%',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <NotificationPrompt onNavigateToSettings={handleNavigateToNotificationSettings} />
                <AddToHomeScreenPrompt />
                <Outlet />
            </Container>

            <Dialog 
                open={showProfile} 
                onClose={() => setShowProfile(false)} 
                fullWidth 
                maxWidth="sm"
                scroll="body"
                PaperProps={{
                    sx: { maxHeight: '90vh' }
                }}
            >
                <DialogTitle>Profile Settings</DialogTitle>
                <DialogContent sx={{ minHeight: 200 }}>
                    <ProfileSettingsDialog onClose={() => setShowProfile(false)} />
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default Layout;