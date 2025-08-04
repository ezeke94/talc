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
    useMediaQuery
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import logo from '../assets/logo.png';

const Layout = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);

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

    const menuItems = [
        { text: 'Dashboard', path: '/' },
        { text: 'Mentors', path: '/mentors' }
    ];

    const drawer = (
        <List>
            {menuItems.map((item) => (
                <ListItem 
                    button 
                    key={item.text} 
                    component={RouterLink} 
                    to={item.path}
                    onClick={handleDrawerToggle}
                >
                    <ListItemText primary={item.text} />
                </ListItem>
            ))}
            <ListItem button onClick={handleLogout}>
                <ListItemText primary="Logout" />
            </ListItem>
        </List>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar position="fixed" elevation={1}>
                <Toolbar>
                    {isMobile && (
                        <IconButton
                            color="inherit"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2 }}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}
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
                        KPI Tracker
                    </Typography>
                    {!isMobile && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {menuItems.map((item) => (
                                <Button 
                                    key={item.text}
                                    color="inherit" 
                                    component={RouterLink} 
                                    to={item.path}
                                >
                                    {item.text}
                                </Button>
                            ))}
                            <Button color="inherit" onClick={handleLogout}>
                                Logout
                            </Button>
                        </Box>
                    )}
                </Toolbar>
            </AppBar>

            <Drawer
                variant="temporary"
                anchor="left"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': { width: 240 },
                }}
            >
                {drawer}
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
                <Outlet />
            </Container>
        </Box>
    );
};

export default Layout;