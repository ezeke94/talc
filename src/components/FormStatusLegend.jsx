import React, { useState } from 'react';
import { 
  Box, 
  Chip, 
  Typography, 
  Collapse, 
  IconButton, 
  Paper,
  Stack
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon 
} from '@mui/icons-material';

const FormStatusLegend = ({ sx = {} }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2, 
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        ...sx 
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer' 
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <InfoIcon color="primary" sx={{ mr: 1, fontSize: 20 }} />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          Form Status Guide
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Form colors indicate submission status for the current month:
          </Typography>
          
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label="Submitted" 
                size="small" 
                color="success"
                variant="filled"
                sx={{ 
                  bgcolor: 'success.main',
                  color: 'success.contrastText' 
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Form completed this month
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label="Pending" 
                size="small" 
                variant="outlined"
                sx={{ 
                  bgcolor: 'grey.300',
                  color: 'text.primary',
                  borderColor: 'grey.400'
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Form not submitted this month
              </Typography>
            </Box>
          </Stack>
          
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Evaluators receive weekly reminders for pending forms assigned to their mentors.
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FormStatusLegend;