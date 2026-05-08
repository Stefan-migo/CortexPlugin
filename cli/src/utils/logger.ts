import chalk from 'chalk';

export function info(msg: string): void {
  console.log(chalk.blue('ℹ'), msg);
}

export function success(msg: string): void {
  console.log(chalk.green('✔'), msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow('⚠'), msg);
}

export function error(msg: string): void {
  console.error(chalk.red('✖'), msg);
}

export function step(msg: string): void {
  console.log(chalk.cyan('\n→'), chalk.bold(msg));
}

export function heading(msg: string): void {
  console.log(chalk.bold.white(`\n${msg}`));
  console.log(chalk.gray('─'.repeat(msg.length)));
}
