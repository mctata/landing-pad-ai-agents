/**
 * Security Check Script
 * 
 * This script performs security checks on the codebase to identify potential security issues.
 * It can be run as part of the CI/CD pipeline or manually.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Security patterns to check for
const SECURITY_PATTERNS = [
  {
    name: 'Hard-coded JWT secret',
    pattern: /['"]JWT_SECRET['"]:\s*['"][a-zA-Z0-9]+['"]/g,
    severity: 'HIGH',
    mitigation: 'Store secrets in environment variables, not in code.'
  },
  {
    name: 'Hard-coded credentials',
    pattern: /(password|passwd|pwd|secret|credentials|api[_\-]?key).*?[=:]\s*['"][^'"]+['"]/gi,
    severity: 'HIGH',
    mitigation: 'Store secrets in environment variables, not in code.'
  },
  {
    name: 'SQL Injection vulnerability',
    pattern: /\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b.*?\$\{.*?\}/gi,
    severity: 'CRITICAL',
    mitigation: 'Use parameterized queries or an ORM instead of string interpolation.'
  },
  {
    name: 'Insecure direct object reference',
    pattern: /req\.params\.(id|userId|username|email)/g,
    severity: 'MEDIUM',
    mitigation: 'Always validate and authorize access to resources before returning them.'
  },
  {
    name: 'No CSRF protection',
    pattern: /app\.use\(.*?session.*?\)(?![\s\S]*?app\.use\(.*?csrf|csurf.*?\))/g,
    severity: 'HIGH',
    mitigation: 'Add CSRF protection using a library like csurf.'
  },
  {
    name: 'Potential command injection',
    pattern: /(?:exec|spawn|execSync)['"(](.*?(?:${|`|req\.|\+\s*user|\+\s*input))/g,
    severity: 'CRITICAL',
    mitigation: 'Avoid using user input in command execution. Use allowlists if necessary.'
  },
  {
    name: 'Potential eval usage',
    pattern: /eval\s*\(|\sFunction\s*\(/g,
    severity: 'CRITICAL',
    mitigation: 'Avoid using eval() or new Function().'
  },
  {
    name: 'Potential RegExp DoS',
    pattern: /new RegExp\(.*?(?:\*|\+).*?\)|\/.*?(?:\*|\+).*?\/[gim]*/g,
    severity: 'MEDIUM',
    mitigation: 'Be careful with regular expressions using repetition with * or +.'
  },
  {
    name: 'Insecure cookie settings',
    pattern: /cookie.*?(?!httpOnly|secure|sameSite)/g,
    severity: 'MEDIUM',
    mitigation: 'Set httpOnly, secure, and sameSite cookie flags.'
  },
  {
    name: 'No Content Security Policy',
    pattern: /app\.use\(helmet\(\)\).*?(?!.*?contentSecurityPolicy)/g,
    severity: 'MEDIUM',
    mitigation: 'Configure Content Security Policy.'
  },
  {
    name: 'Potential path traversal',
    pattern: /(?:fs|path)\.(?:readFile|readFileSync|writeFile|writeFileSync|unlink|unlinkSync|exists|existsSync|stat|statSync|createReadStream)\s*\(.*?(?:${|req\.|\+\s*user|\+\s*input)/g,
    severity: 'HIGH',
    mitigation: 'Validate and sanitize file paths. Use path.join() and path.normalize().'
  }
];

// List of files and directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '__tests__' // Exclude test files
];

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];

// Track findings
const findings = [];

/**
 * Check a file for security issues
 * @param {string} filePath - Path to the file to check
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  SECURITY_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern.pattern);
    
    if (matches) {
      matches.forEach(match => {
        // Extract line number of the match
        const lines = content.substring(0, content.indexOf(match)).split('\n');
        const lineNumber = lines.length;
        
        findings.push({
          file: relativePath,
          line: lineNumber,
          pattern: pattern.name,
          severity: pattern.severity,
          match: match.trim(),
          mitigation: pattern.mitigation
        });
      });
    }
  });
}

/**
 * Recursively scan directories for files to check
 * @param {string} dir - Directory to scan
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        scanDirectory(filePath);
      }
    } else if (SUPPORTED_EXTENSIONS.includes(path.extname(file))) {
      checkFile(filePath);
    }
  });
}

/**
 * Scan dependencies for vulnerabilities using npm audit
 */
function scanDependencies() {
  try {
    console.log('Scanning dependencies for vulnerabilities...');
    const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
    const auditData = JSON.parse(auditOutput);
    
    if (auditData.vulnerabilities) {
      console.log(`\nDependency vulnerabilities found: ${Object.keys(auditData.vulnerabilities).length}`);
      console.log('Run npm audit for details');
    } else {
      console.log('No dependency vulnerabilities found');
    }
    
    return auditData;
  } catch (error) {
    if (error.stdout) {
      try {
        const auditData = JSON.parse(error.stdout);
        const vulnCount = Object.keys(auditData.vulnerabilities || {}).length;
        console.log(`\nDependency vulnerabilities found: ${vulnCount}`);
        console.log('Run npm audit for details');
        return auditData;
      } catch (e) {
        console.error('Error parsing npm audit output:', e);
      }
    } else {
      console.error('Error running npm audit:', error);
    }
    return { vulnerabilities: {} };
  }
}

/**
 * Generate a text report of the findings
 */
function generateReport(depAudit) {
  console.log('\n----- SECURITY CHECK REPORT -----\n');
  
  if (findings.length === 0) {
    console.log('No security issues found in code scan.');
  } else {
    console.log(`Found ${findings.length} potential security issues:\n`);
    
    // Group findings by severity
    const bySeverity = findings.reduce((acc, finding) => {
      acc[finding.severity] = acc[finding.severity] || [];
      acc[finding.severity].push(finding);
      return acc;
    }, {});
    
    // Display findings in order of severity
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
      if (bySeverity[severity] && bySeverity[severity].length > 0) {
        console.log(`\n${severity} severity issues (${bySeverity[severity].length}):`);
        
        bySeverity[severity].forEach(finding => {
          console.log(`\n  File: ${finding.file}:${finding.line}`);
          console.log(`  Issue: ${finding.pattern}`);
          console.log(`  Match: ${finding.match}`);
          console.log(`  Mitigation: ${finding.mitigation}`);
        });
      }
    });
  }
  
  // Dependency vulnerabilities summary
  if (depAudit.vulnerabilities && Object.keys(depAudit.vulnerabilities).length > 0) {
    console.log('\n----- DEPENDENCY VULNERABILITIES -----\n');
    
    // Count by severity
    const vulnCount = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0
    };
    
    Object.values(depAudit.vulnerabilities).forEach(vuln => {
      const severity = vuln.severity.toLowerCase();
      if (vulnCount[severity] !== undefined) {
        vulnCount[severity]++;
      }
    });
    
    console.log('Summary:');
    console.log(`  Critical: ${vulnCount.critical}`);
    console.log(`  High: ${vulnCount.high}`);
    console.log(`  Moderate: ${vulnCount.moderate}`);
    console.log(`  Low: ${vulnCount.low}`);
    
    console.log('\nRun npm audit for details');
  }
  
  console.log('\n----- END OF REPORT -----\n');
}

// Main function
function main() {
  console.log('Starting security check...');
  
  // Scan code for security issues
  console.log('Scanning code for security issues...');
  scanDirectory(process.cwd());
  
  // Scan dependencies
  const depAudit = scanDependencies();
  
  // Generate report
  generateReport(depAudit);
  
  // Exit with error code if issues found
  if (findings.length > 0 || 
      (depAudit.vulnerabilities && Object.keys(depAudit.vulnerabilities).length > 0)) {
    process.exit(1);
  }
}

// Run main function
main();