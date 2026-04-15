#!/bin/bash
# FB Outreach Bot - Quick Launch Script

echo "🚀 FB Outreach Bot - Quick Launch"
echo "=================================="
echo ""

# Check we're in the right directory
if [ ! -d "pipeline" ]; then
    echo "❌ Error: Run this from /Users/anish/Desktop/cos448/"
    exit 1
fi

echo "📋 What would you like to do?"
echo ""
echo "1. Quick test (verify everything works)"
echo "2. Test scraping with screenshots"
echo "3. Run full scrape cycle"
echo "4. Export leads to CSV"
echo "5. Run messenger bot (send messages)"
echo "6. Check database stats"
echo ""
read -p "Enter choice (1-6): " choice
echo ""

case $choice in
    1)
        echo "Running quick test..."
        cd pipeline && node quick-test.js
        ;;
    2)
        echo "Running scraper test with screenshots..."
        echo "⚠️  Browser will open - log into Facebook if needed"
        cd pipeline && node test-scraper-live.js
        ;;
    3)
        echo "Running full scrape cycle..."
        echo "⚠️  This will:"
        echo "   - Open browser and navigate to Facebook groups"
        echo "   - Search for leads"
        echo "   - Classify comments using LLM (if AWS configured)"
        echo "   - Save leads to database"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            cd pipeline && node -e "
            import('./fb-finder/scraper.js').then(async ({ runScrapeCycle }) => {
              import('./db.js').then(({ getDb }) => {
                const db = getDb();
                const groups = db.prepare('SELECT * FROM fb_groups WHERE status = \\'ACTIVE\\'').all();
                console.log('Running scrape for', groups.length, 'groups...');
                runScrapeCycle(groups).then(stats => {
                  console.log('\\\\nScrape complete!');
                  console.log('Stats:', stats);
                  process.exit(0);
                });
              });
            }).catch(e => { console.error('Error:', e.message); process.exit(1); });
            "
        fi
        ;;
    4)
        echo "Exporting leads to CSV..."
        cd pipeline && node -e "
        import('./fb-finder/lead-exporter.js').then(({ exportLeadsToCSV }) => {
          const csvPath = exportLeadsToCSV();
          console.log('✓ Leads exported to:', csvPath);
        }).catch(e => console.error('Error:', e.message));
        "
        ;;
    5)
        echo "⚠️  Messenger bot requires:"
        echo "   1. Leads exported to CSV (run option 4 first)"
        echo "   2. campaign.config.json file"
        echo "   3. message-template.txt file"
        echo ""
        read -p "Have you set these up? (y/n): " ready
        if [ "$ready" = "y" ]; then
            node scripts/fb-review-send.js --config campaign.config.json
        else
            echo "Please set up the required files first."
            echo "See TEST_FB_BOT.md for instructions."
        fi
        ;;
    6)
        echo "Database Statistics:"
        echo "===================="
        cd pipeline && node -e "
        import('./db.js').then(({ getDb }) => {
          const db = getDb();
          const groups = db.prepare('SELECT * FROM fb_groups').all();
          const leads = db.prepare('SELECT * FROM fb_leads').all();
          const exported = db.prepare('SELECT COUNT(*) as count FROM fb_leads WHERE outreach_state = \\'EXPORTED_CSV\\'').get();
          const messaged = db.prepare('SELECT COUNT(*) as count FROM fb_leads WHERE outreach_state = \\'MESSAGED\\'').get();

          console.log('\\nGroups:', groups.length);
          for (const g of groups) {
            console.log('  -', g.group_name || g.group_url);
            console.log('    Posts:', g.total_posts_scanned, '| Comments:', g.total_comments_scanned, '| Leads:', g.total_leads_found);
          }

          console.log('\\nLeads:', leads.length);
          console.log('  - Exported:', exported.count);
          console.log('  - Messaged:', messaged.count);
          console.log('  - Queued:', leads.length - exported.count - messaged.count);
        }).catch(e => console.error('Error:', e.message));
        "
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
