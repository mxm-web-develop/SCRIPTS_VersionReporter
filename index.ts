import {existsSync,mkdirSync,readdirSync,statSync,writeFileSync} from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import config from './config.json' assert { type: 'json' };
import EnvManager from '../envManager';

const deployReportsPath = path.join(config.rootPath, 'deploy_reports');
const devEnv = new EnvManager(config.rootPath+"/"+'.env.development')
const prodEnv = new EnvManager(config.rootPath+'/'+'.env.production')
if (!existsSync(deployReportsPath)) {
  mkdirSync(deployReportsPath);
}

// 获取所有 .md 文件，并按照最后修改时间排序
const mdFiles = readdirSync(deployReportsPath)
  .filter(file => file.endsWith('.md'))
  .map(file => {
    return {
      name: file,
      time: statSync(path.join(deployReportsPath, file)).mtime.getTime()
    };
  })
  .sort((a, b) => b.time - a.time);
const latestCommit = execSync('git rev-parse HEAD').toString().trim();
// let flieRecordedCommit = '';

if (mdFiles.length > 0) {
  const newestMdFileName = mdFiles[0].name;
  const latestCommitDetails = execSync(`git show -s --format="%h|%ci" ${latestCommit}`, { encoding: 'utf-8' }).trim();
  const flieRecordedCommit = newestMdFileName.split('&')[1].split('.')[0]; // 假设文件名格式是 "日期&commitID.md"
  const flieRecordedData = newestMdFileName.split('&')[0].split('.')[0];
  const [latestShortCommit, commitDate] = latestCommitDetails.split('|');
 
  console.log("flieRecordedData:",flieRecordedData,
  "flieRecordedCommit:",flieRecordedCommit,
  "latestShortCommit:",latestShortCommit,
  )
  if(flieRecordedCommit !== latestShortCommit){
    //这个逻辑是需要新建md的
     // 需要创建新的 .md 文件
     const logs = execSync(`git log ${flieRecordedCommit}..${latestShortCommit} --no-merges --pretty=format:"%h|%an|%ad|%s"`, { encoding: 'utf-8' });
     const latestCommitDate = commitDate.split(' ')[0];
     const [year, month, day] = latestCommitDate.split('-');
     const formattedDate = `${month}${day}`;
     const mdFileName = `${formattedDate}&${latestShortCommit}.md`;
     const mdFilePath = path.join(deployReportsPath, mdFileName);
    //获取logs中在flieRecordedCommit之后产生的commit，用之前的格式生成.md内容
    let newCommitSinceLastCommit = `- ### V_${formattedDate}&${latestShortCommit}\n|更新内容|更新时间|更新人|commitId|\n|-|-|-|-|\n`;
    logs.split('\n').forEach(log => {
      const [commit, author, date, message] = log.split('|');
      if (!/merge/i.test(message)) {
        const formattedDateTime = new Date(date).toISOString().replace(/T/, ' ').replace(/\..+/, '').slice(2);
        newCommitSinceLastCommit += `|${message}|${formattedDateTime}|${author}|${commit}|\n`;
      }
    });
    prodEnv.update([{
      "VITE_APP_VERSION":mdFileName
    }])
    writeFileSync(mdFilePath, newCommitSinceLastCommit);
    console.log(`flieRecordedCommit !== latestShortCommit，创建了文件：${mdFilePath}`);
  }else{
    console.log(`已经是最新版本`);
  }
}else{
  //完全没有文件
  const logCommand = `git log --no-merges --pretty=format:"%h|%an|%ad|%s"`;
  const logs = execSync(logCommand, { encoding: 'utf-8' });
  const latestCommitDetails = execSync(`git show -s --format="%h|%ci" ${latestCommit}`, { encoding: 'utf-8' }).trim();
  const [latestShortCommit, commitDate] = latestCommitDetails.split('|');
  // 提取日期部分（格式："YYYY-MM-DD HH:MM:SS"）
  const latestCommitDate = commitDate.split(' ')[0];
  // 将日期转换为 MMDD 格式
  const [year, month, day] = latestCommitDate.split('-');
  const formattedDate = `${month}${day}`;
  // 构建 .md 文件名
  const mdFileName = `${formattedDate}&${latestShortCommit}.md`;
  const mdFilePath = path.join(deployReportsPath, mdFileName);
    let mdContent = `- ### V_${formattedDate}&${latestShortCommit}\n|更新内容|更新时间|更新人|commitId|\n|-|-|-|-|\n`;
    logs.split('\n').forEach(log => {
      const [commit, author, date, message] = log.split('|');
      if (!/merge/i.test(message)) {
        const formattedDateTime = new Date(date).toISOString().replace(/T/, ' ').replace(/\..+/, '').slice(2);
        mdContent += `|${message}|${formattedDateTime}|${author}|${commit}|\n`;
      }
    });
    prodEnv.update([{
      "VITE_APP_VERSION":mdFileName
    }])
    writeFileSync(mdFilePath, mdContent);
    console.log(`创建了文件：${mdFilePath}`);
}



