import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

count = content.count('solid(')
print(f'替换前 solid( 出现次数: {count}')

# 修复 background: solid(...) 或 background:solid(...) -> linear-gradient
content = re.sub(r'background:\s*solid\(', 'background: linear-gradient(', content)

# 修复 -webkit-mask: solid(#fff 0 0) -> linear-gradient(#fff 0 0)
content = content.replace('-webkit-mask: solid(#fff 0 0)', '-webkit-mask: linear-gradient(#fff 0 0)')

# 删除残留的错误行 background: linear-gradient(90, 150px, 30%, 100%);
content = content.replace('background: linear-gradient(90, 150px, 30%, 100%);', '')

count_after = content.count('solid(')
print(f'替换后 solid( 出现次数: {count_after}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('完成')
