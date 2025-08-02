// Add scrolled class to navbar when user scrolls
$(document).ready(function () {
    $(window).scroll(function () {
        const scrollPosition = $(window).scrollTop();

        // Add 'scrolled' class when user scrolls more than 50px
        if (scrollPosition > 50) {
            $('#navbar').addClass('scrolled');
        } else {
            $('#navbar').removeClass('scrolled');
        }
    });
});