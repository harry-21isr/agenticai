import chalk from 'chalk';

// Logger class for handling and storing logs
class Logger {
    // Constructor method initializes the logs array and defines the log types
    constructor() {
        this.logs = []; // Array to store log messages
        this.types = { // Log types and their associated colors and prefixes
            info: { color: 'blue', prefix: 'Info: ' },
            warning: { color: 'yellow', prefix: 'Warning: ' },
            error: { color: 'red', prefix: 'Error: ' },
            fatal: { color: 'magenta', prefix: 'Fatal: ' },
            default: { color: 'white', prefix: '' }
        };
    }

    // log method for adding new log messages
    log(message, type = 'default') {
        type = type.toLowerCase();
        // Fallback to 'default' if the provided type isn't defined
        if (!this.types[type]) {
            type = 'default';
        }
        const { color, prefix } = this.types[type]; // Destructure color and prefix from the types object

        // Handle the special case for 'info' type to have a white prefix
        if (type === 'info') {
            this.logs.push({ message: chalk.white(prefix) + chalk[color](message), type });
        } else {
            this.logs.push({ message: chalk.red(prefix) + chalk[color](message), type }); // Push the log message with its associated color to the logs array
        }
    }

    // printLogs method for printing all stored logs to the console
    printLogs() {
        // Print a bold yellow separator line before the logs
        console.log(chalk.yellow.bold('\n----------------------------------------------------------------- script log -----------------------------------------------------------------\n'));
        console.log(`Info: ${chalk.white.bold('Build script start')}`);

        // Order types for printing
        const orderedTypes = ['info', 'warning', 'error', 'fatal'];

        // Iterate over the ordered types and print each log with its associated color
        orderedTypes.forEach(type => {
            this.logs
                .filter(log => log.type === type)
                .forEach(log => console.log(log.message));
        });

        // Print a bold yellow separator line after the logs
        console.log(`Info: ${chalk.white.bold('Build script end')}`);
        console.log(chalk.yellow.bold('\n----------------------------------------------------------------------------------------------------------------------------------------------\n'));
    }
}

// Create a new Logger instance and export it as the default export
const logger = new Logger();
export default logger;

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}