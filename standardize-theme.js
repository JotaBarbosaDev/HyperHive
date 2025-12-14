#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Comprehensive color replacement patterns
const replacements = [
	// Refresh control colors
	{ from: /"#F8FAFC"/g, to: '"rgb(248, 250, 252)"' },
	{ from: /"#0F172A"/g, to: '"rgb(15, 23, 42)"' },
	{ from: /"#0E1524"/g, to: '"rgb(30, 41, 59)"' },
	{ from: /"#E2E8F0"/g, to: '"rgb(226, 232, 240)"' },

	// Specific hardcoded colors in className
	{ from: /border-outline-100 bg-background-0 dark:border-\[#2A3B52\] dark:bg/g, to: 'border-border-primary bg-background-elevated dark:bg' },
	{ from: /dark:border-\[#2A3B52\]/g, to: 'dark:border-border-primary' },
	{ from: /dark:bg-\[#0A1628\]/g, to: 'dark:bg-background-tertiary' },
	{ from: /dark:bg-\[#151F30\]/g, to: 'dark:bg-background-tertiary' },
	{ from: /dark:web:bg-\[#151F30\]\/80/g, to: 'dark:web:bg-background-tertiary/80' },
	{ from: /border-outline-200 dark:border/g, to: 'border-border-primary dark:border' },
	{ from: /bg-background-0 (?!dark:)/g, to: 'bg-background-elevated ' },
	{ from: /text-\[#2DD4BF\] dark:text-\[#5EEAD4\]/g, to: 'text-[rgb(var(--accent-primary))]' },
	{ from: /bg-\[#9AA4B819\]/g, to: 'bg-zinc-400/10' },
	{ from: /border-\[#9AA4B8\]/g, to: 'border-zinc-400' },
	{ from: /dark:bg-\[#9AA4B825\]/g, to: 'dark:bg-zinc-400/15' },
	{ from: /dark:border-\[#94a3b8\]/g, to: 'dark:border-zinc-400' },
	{ from: /text-\[#475569\]/g, to: 'text-zinc-600' },
	{ from: /dark:text-\[#cbd5e1\]/g, to: 'dark:text-zinc-300' },

	// Badge/status colors - keep accent colors but use variables
	{ from: /#3b82f6/g, to: 'rgb(59 130 246)' },
	{ from: /#60a5fa/g, to: 'rgb(96 165 250)' },
	{ from: /#ef4444/g, to: 'rgb(239 68 68)' },
	{ from: /#f87171/g, to: 'rgb(248 113 113)' },
	{ from: /#22c55e/g, to: 'rgb(34 197 94)' },
	{ from: /#4ade80/g, to: 'rgb(74 222 128)' },
];

function processFile(filePath) {
	try {
		let content = fs.readFileSync(filePath, 'utf8');
		let changed = false;
		let changeCount = 0;

		replacements.forEach(({ from, to }) => {
			const matches = (content.match(from) || []).length;
			if (matches > 0) {
				content = content.replace(from, to);
				changed = true;
				changeCount += matches;
			}
		});

		if (changed) {
			fs.writeFileSync(filePath, content, 'utf8');
			console.log(`✓ Updated: ${path.basename(filePath)} (${changeCount} changes)`);
			return true;
		}
		return false;
	} catch (error) {
		console.error(`✗ Error processing ${filePath}:`, error.message);
		return false;
	}
}

function processDirectory(directory, extensions = ['.tsx', '.ts']) {
	const files = fs.readdirSync(directory);
	let totalUpdated = 0;

	files.forEach(file => {
		const filePath = path.join(directory, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
			totalUpdated += processDirectory(filePath, extensions);
		} else if (stat.isFile() && extensions.some(ext => file.endsWith(ext))) {
			if (processFile(filePath)) {
				totalUpdated++;
			}
		}
	});

	return totalUpdated;
}

// Main execution
const appDir = path.join(__dirname, 'app');
console.log('🎨 Starting comprehensive theme standardization...\n');
const updated = processDirectory(appDir);
console.log(`\n✨ Complete! Updated ${updated} files with standardized theme tokens.`);
