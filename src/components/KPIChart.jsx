import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { Box, Typography } from '@mui/material';

const COLORS = {
    "Critical": "#D9534F",
    "Not Up to Expectation": "#F0AD4E",
    "As Expected": "#D3D3D3",
    "Shows Intention": "#5BC0DE",
    "Exceeds Expectations / Exceptional": "#428BCA",
};

const KPIChart = ({ data, onSegmentClick }) => {
    if (!data || data.length === 0) {
        return <Typography sx={{mt: 4, textAlign: 'center'}}>No data available for the selected filters.</Typography>
    }

    // Calculate total for percentage
    const total = data.reduce((sum, entry) => sum + entry.value, 0);
    
    const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
        // Convert midAngle to radians and calculate label position
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        // Only show label if percentage is greater than 3%
        if (percent < 0.03) return null;

        return (
            <text
                x={x}
                y={y}
                fill="#000"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12px"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };
    
    return (
        <Box sx={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        labelLine={false}
                        label={CustomLabel}
                        onClick={(entry) => onSegmentClick(entry)}
                    >
                        {data.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[entry.name]} 
                                style={{ cursor: 'pointer' }}
                            />
                        ))}
                    </Pie>
                    <Tooltip 
                        formatter={(value) => [`${((value/total) * 100).toFixed(1)}% (${value} mentors)`, 'Distribution']}
                    />
                    <Legend 
                        formatter={(value, entry) => {
                            const count = entry.payload.value;
                            const percentage = ((count/total) * 100).toFixed(1);
                            return `${value} (${count} - ${percentage}%)`;
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </Box>
    );
};

export default KPIChart;