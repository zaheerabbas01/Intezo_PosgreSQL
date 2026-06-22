import autocannon from 'autocannon';

const result = await autocannon({
  url: 'https://api.intezo.online/sitemap.xml',
  connections: 10,
  duration: 10,
  workers: 2
});

console.log('\n=== SERVER CAPACITY TEST (PRODUCTION) ===\n');
console.log(`Requests/sec: ${result.requests.average}`);
console.log(`Latency (avg): ${result.latency.average}ms`);
console.log(`Latency (p99): ${result.latency.p99}ms`);
console.log(`Total requests: ${result.requests.total}`);
console.log(`Errors: ${result.errors}`);
console.log(`Timeouts: ${result.timeouts}`);
console.log(`2xx responses: ${result['2xx']}`);
console.log(`Non-2xx: ${result.non2xx}`);
console.log(`Throughput: ${(result.throughput.average / 1024).toFixed(2)} KB/sec`);
console.log('\n========================\n');
