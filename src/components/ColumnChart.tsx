import { useState, useEffect, useRef, useCallback } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    LineChart,
    Line,
    PieChart,
    Pie
} from 'recharts';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';

interface ColumnChartProps {
    data: any[];
    type: 'number' | 'category' | 'date' | 'boolean' | 'unsupported';
    columnName?: string;
}

const COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
];

export default function ColumnChart({ data, type, columnName }: ColumnChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry.contentRect.width > 0 && entry.contentRect.width !== width) {
                setWidth(entry.contentRect.width);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [width]);

    const handleDownload = useCallback(async () => {
        if (!containerRef.current) return;

        setIsDownloading(true);
        try {
            // Wait a tiny bit more to ensure Recharts has finished any internal updates
            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = await toPng(containerRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 2, // Higher resolution
                cacheBust: true,
            });
            const link = document.createElement('a');
            link.download = `chart-${columnName || 'distribution'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to download chart:', err);
        } finally {
            setIsDownloading(false);
        }
    }, [columnName]);

    if (!data || data.length === 0) {
        return (
            <div className="h-32 flex items-center justify-center bg-stone-50/50 rounded-xl border border-stone-100">
                <span className="text-[10px] font-medium text-stone-400">No data available</span>
            </div>
        );
    }

    // Don't render charts until we have a valid width
    if (width <= 0) {
        return <div ref={containerRef} className="w-full h-32 mt-2" />;
    }

    const renderChart = () => {
        const commonProps = {
            width: width,
            height: 128,
            data: data,
            margin: { top: 10, right: 10, left: 10, bottom: 5 }
        };

        const tooltipProps = {
            contentStyle: {
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '4px 8px',
                background: 'white'
            },
            cursor: { fill: '#f8fafc' }
        };

        switch (type) {
            case 'number':
            case 'category':
                return (
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip {...tooltipProps} />
                        <Bar
                            dataKey="count"
                            radius={[2, 2, 0, 0]}
                            barSize={width > 0 ? Math.min(width / (data.length || 1) - 2, 30) : 20}
                            isAnimationActive={false}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                );

            case 'date':
                return (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip {...tooltipProps} />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke={COLORS[0]}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                );

            case 'boolean':
                return (
                    <PieChart width={width} height={128} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={45}
                            paddingAngle={5}
                            isAnimationActive={false}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip {...tooltipProps} />
                    </PieChart>
                );

            default:
                return null;
        }
    };

    return (
        <div className="group relative w-full mt-2">
            <div ref={containerRef} className="w-full relative overflow-hidden bg-white rounded-xl" style={{ height: '128px' }}>
                {renderChart()}
            </div>

            <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="absolute top-2 right-2 p-1.5 bg-white/90 border border-stone-200 rounded-lg text-stone-400 hover:text-emerald-500 hover:border-emerald-200 hover:shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10 disabled:opacity-50"
                title="Download Chart"
            >
                {isDownloading ? (
                    <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Download size={14} />
                )}
            </button>
        </div>
    );
}
