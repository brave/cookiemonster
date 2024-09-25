function onSubmitReport() {
  // TODO - actually send the report
  document.getElementById('detected').classList.remove('active')
  document.getElementById('thanks').classList.add('active')
}

const reportButton = document.getElementById('report');
reportButton.addEventListener('click', onSubmitReport);
