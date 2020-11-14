
export default function () {
    Handlebars.registerHelper('concat', function (a, b) {
        return a + b;
    });
    Handlebars.registerHelper('concatUp', function (a, b) {
        return a + b.toUpperCase();
    });
}