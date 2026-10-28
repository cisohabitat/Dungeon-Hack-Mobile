'use strict';
// Only resource counters and process names; never environment or command lines.
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const read = path => {
  try { return {path, text: fs.readFileSync(path, 'utf8').trim()}; }
  catch (error) { return {path, unavailable: error.code}; }
};
const command = (file, args) => {
  const result = spawnSync(file, args, {encoding: 'utf8', timeout: 2000, maxBuffer: 1024 * 1024});
  return {status: result.status, signal: result.signal, error: result.error?.code,
    stdout: result.stdout || '', stderr: result.stderr || ''};
};
const kernelArgs = ['--level=emerg,alert,crit,err,warn', '--color=never'];
let kernel = command('dmesg', kernelArgs);
if (kernel.status !== 0 && process.env.GITHUB_ACTIONS === 'true') {
  kernel = command('sudo', ['-n', 'dmesg', ...kernelArgs]);
}
// A restricted runner may deny kernel/cgroup reads. Record that absence rather
// than treating missing counters as proof that no native fault or OOM occurred.
if (kernel.status === 0) kernel.stdout = kernel.stdout.split('\n')
  .filter(line => /out of memory|oom-kill|killed process|segfault|trap/i.test(line)).join('\n');
console.log(JSON.stringify({
  recordedAt: new Date().toISOString(), node: process.version,
  memory: read('/proc/meminfo'), cgroup: read('/proc/self/cgroup'),
  cgroupRoot: ['memory.current', 'memory.peak', 'memory.max', 'memory.events', 'memory.events.local']
    .map(name => read('/sys/fs/cgroup/' + name)),
  pressure: ['cpu', 'memory', 'io'].map(name => read('/proc/pressure/' + name)),
  processes: command('ps', ['-eo', 'pid,ppid,stat,rss,comm', '--sort=-rss']),
  kernel,
}, null, 2));
