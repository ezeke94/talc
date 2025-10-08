import React, { useState } from 'react';
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
    DialogContent
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
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
    const menuItems = [
        { text: 'Calendar', path: '/calendar' },
        { text: 'KPI Dashboard', path: '/kpi-dashboard' },
        { text: 'Operational Dashboard', path: '/operational-dashboard' },
        { text: 'SOP Management', path: '/sop-management' },
        ...(showUserManagement ? [{ text: 'Form Management', path: '/form-management' }] : []),
        ...(showUserManagement ? [{ text: 'User Management', path: '/user-management' }] : []),
        { text: 'Mentors', path: '/mentors' }
    ];

    const drawer = (
        <List>
            {menuItems.map((item) => (
                <ListItem 
                    key={item.text} 
                    component={RouterLink} 
                    to={item.path}
                    onClick={handleDrawerToggle}
                >
                    <ListItemText primary={item.text} />
                </ListItem>
            ))}
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
                            {menuItems.map((item) => (
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