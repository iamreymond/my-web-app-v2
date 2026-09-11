const message = document.getElementById('message')
const messageButton = document.getElementById('messageButton')

messageButton.addEventListener('click', () => {
    message.textContent = 'JavaScript successfully changed the page.'
})