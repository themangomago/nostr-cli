import requests
from datetime import datetime

def download_and_concatenate_files():
    file_content = '## NIPS from the Nostr Protocol GitHub repository\n\n'
    file_content += 'This file was generated on {}.\n\n'.format(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))


    for i in range(1, 101):
        file_number = str(i).zfill(2)
        file_url = 'https://raw.githubusercontent.com/nostr-protocol/nips/master/{}.md'.format(file_number)

        try:
            response = requests.get(file_url)
            if response.text != '404: Not Found':
                file_content += '\n\n---\n\n{}'.format(response.text)
        except Exception as e:
            # If there is an error, it means that the file doesn't exist, so we can just ignore it.
            print(e)

    with open('nostr-nips.md', 'w') as f:
        f.write(file_content)

    print('Finished downloading and concatenating files!')

download_and_concatenate_files()
