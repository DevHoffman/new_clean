/* Collection handle from a title: "Papel higiênico e toalha" => "papel-higienico-e-toalha" */
module.exports = (title) =>
  String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
