const functions = require('firebase-functions');
const admin = require('firebase-admin');

const vietnameseMap = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ằ':'a','ắ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'â':'a','ầ':'a','ấ':'a','ẩ':'a','ẫ':'a','ậ':'a','è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ề':'e','ế':'e','ể':'e','ễ':'e','ệ':'e','ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ồ':'o','ố':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ờ':'o','ớ':'o','ở':'o','ỡ':'o','ợ':'o','ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ừ':'u','ứ':'u','ử':'u','ữ':'u','ự':'u','ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y',
    'đ':'d','Đ':'d'
};

function createSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split('')
        .map(c => vietnameseMap[c] || c)
        .join('')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim();
}

exports.fixAllSlugs = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🔍 Starting slug fix...');
        
        const db = admin.firestore();
        const snapshot = await db.collection('businesses').get();
        
        console.log(`📊 Found ${snapshot.size} businesses`);
        
        const updates = [];
        const fixes = [];
        
        snapshot.forEach(doc => {
            const business = doc.data();
            const currentSlug = business.slug || '';
            const correctSlug = createSlug(business.name);
            
            if (currentSlug !== correctSlug) {
                console.log(`🔧 Fixing: ${business.name}`);
                console.log(`   Old: ${currentSlug} → New: ${correctSlug}`);
                
                fixes.push({
                    name: business.name,
                    oldSlug: currentSlug,
                    newSlug: correctSlug
                });
                
                updates.push(
                    doc.ref.update({ slug: correctSlug })
                );
            }
        });
        
        await Promise.all(updates);
        
        console.log(`✅ Fixed ${fixes.length} slugs!`);
        
        res.status(200).json({
            success: true,
            message: `Fixed ${fixes.length} slugs`,
            fixes: fixes
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});