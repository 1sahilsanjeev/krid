export const PRESET_QUERIES: Record<string, string> = {
    // Sales Presets
    "Sort the data by price in ascending order": "SELECT * FROM sales ORDER BY price ASC",
    "Calculate the total revenue for each category": "SELECT category, SUM(revenue) as total_revenue FROM sales GROUP BY category",
    "Find the product with the highest quantity": "SELECT product, quantity FROM sales ORDER BY quantity DESC LIMIT 1",
    "Show the average price for each region": "SELECT region, AVG(price) as avg_price FROM sales GROUP BY region",

    // Sample/Users Presets
    "List all users who have signed up in the last month": "SELECT * FROM sample WHERE signup_date > CURRENT_DATE - INTERVAL '1 month'",
    "Calculate the average number of signups per country": "SELECT country, COUNT(*) as signup_count FROM sample GROUP BY country",
    "Find the top 3 plans with the most active users": "SELECT plan, COUNT(*) as user_count FROM sample WHERE status = 'active' GROUP BY plan ORDER BY user_count DESC LIMIT 3",
    "Identify any users with duplicate email addresses": "SELECT email, COUNT(*) FROM sample GROUP BY email HAVING COUNT(*) > 1",

    // API Logs Presets
    "Find the top 3 endpoints with the highest average latency": "SELECT endpoint, AVG(latency_ms) as avg_latency FROM api_logs GROUP BY endpoint ORDER BY avg_latency DESC LIMIT 3",
    "List all distinct methods and the count of requests for each method": "SELECT method, COUNT(*) as request_count FROM api_logs GROUP BY method",
    "Show the requests with the highest latency in the last hour": "SELECT * FROM api_logs WHERE timestamp > now()::TIMESTAMP - INTERVAL '1 hour' ORDER BY latency_ms DESC",
    "Get the average latency for each status category": "SELECT status, AVG(latency_ms) as avg_latency FROM api_logs GROUP BY status"
};

export function getPresetSQL(query: string): string | null {
    return PRESET_QUERIES[query] || null;
}
