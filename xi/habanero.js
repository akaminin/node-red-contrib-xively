function httpNodeMiddleware(req,res,next) {
    //
    
    next();
}

module.exports = {
    middleware: httpNodeMiddleware
};